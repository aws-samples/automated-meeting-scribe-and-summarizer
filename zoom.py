
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
import asyncio
import boto3
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import os
from playwright.async_api import async_playwright
import re
import sounddevice as sd
import string

scribe_name = "Scribe"
email_address = os.environ['EMAIL']
scribe_identity = f"{scribe_name} ({email_address})"

attendees = []
messages = []
attachments = {}
captions = []
speakers = []

current_speaker = ""
meeting_end = False

start = False

def remove_punctuation(text: str):
    return text.translate(str.maketrans('', '', string.punctuation))

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        # This handler can be implemented to handle transcriptions as needed.
        # Here's an example to get started.
        results = transcript_event.transcript.results
        for result in results:
            for alt in result.alternatives:
                line = alt.transcript
                print(line)
                if captions:
                    if remove_punctuation(captions[-1]) in remove_punctuation(line):
                        captions[-1] = line
                        continue
                captions.append(line)
                speakers.append(current_speaker)

async def write_audio(stream):
    loop = asyncio.get_event_loop()
    input_queue = asyncio.Queue()

    def callback(indata, frame_count, time_info, status):
        loop.call_soon_threadsafe(input_queue.put_nowait, (bytes(indata), status))

    # Create the audio stream
    with sd.RawInputStream(
        channels=1,
        samplerate=16000,
        callback=callback,
        blocksize=1024 * 2,
        dtype='int16'
        # device="pulse"
    ):
        while not meeting_end:
            indata, status = await input_queue.get()
            await stream.input_stream.send_audio_event(audio_chunk=indata)
        
        await stream.input_stream.end_stream()

async def transcribe():

    stream = await TranscribeStreamingClient(region="us-east-1").start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    await asyncio.gather(
        write_audio(stream), 
        MyEventHandler(stream.output_stream).handle_events()
    )

def deliver():

    email_source = f"{scribe_name} <{'+scribe@'.join(email_address.split('@'))}>"
    email_destinations = [email_address]

    msg = MIMEMultipart('mixed')
    msg['From'] = email_source
    msg['To'] = ', '.join(email_destinations)

    if not start:
        msg['Subject'] = os.environ['MEETING_NAME']
        body_html = body_text = "No meeting details were saved."
    else:
        attendance = '\n'.join(attendees)
        chat = '\n'.join(messages)
        transcriptions = [f"{speaker}: {caption}" for speaker, caption in zip(speakers, captions)]
        transcript = '\n\n'.join(transcriptions)

        prompt = (
            "Please create a title, summary, and list of action items from the following transcript:"
            f"\n<transcript>{transcript}</transcript>"
            "\nPlease output the title in <title></title> tags, the summary in <summary></summary> tags,"
            " and the action items in <action items></action items> tags."
        )
        body = json.dumps({
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
            "anthropic_version": "bedrock-2023-05-31"
        })
        try: 
            response = boto3.client("bedrock-runtime").invoke_model(
                body=body, modelId="anthropic.claude-3-sonnet-20240229-v1:0"
            )
            bedrock_completion = json.loads(response.get("body").read())["content"][0]["text"]
        except Exception as e:
            print(f"Error while invoking model: {e}")
            bedrock_completion = ""

        title = re.findall(r'<title>(.*?)</title>|$', bedrock_completion, re.DOTALL)[0].strip()
        summary = re.findall(r'<summary>(.*?)</summary>|$', bedrock_completion, re.DOTALL)[0].strip()
        action_items = re.findall(
            r'<action items>(.*?)</action items>|$', bedrock_completion, re.DOTALL
        )[0].strip()   

        msg['Subject'] = f"{os.environ['MEETING_NAME']} | {title}"

        body_text = "Attendees:\n" + attendance + "\nSummary:\n" + summary \
            + "\n\nAction Items:\n" + action_items
        newline = '\n'
        body_html = f"""
        <html>
            <body>
                <h4>Attendees</h4>
                <p>{attendance.replace(newline, '<br>')}</p>
                <h4>Summary</h4>
                <p>{summary.replace(newline, '<br>')}</p>
                <h4>Action Items</h4>
                <p>{action_items.replace(newline, '<br>')}</p>
            </body>
        </html>
        """

        attachment = MIMEApplication(transcript)
        attachment.add_header('Content-Disposition','attachment',filename="transcript.txt")
        msg.attach(attachment)

        attachment = MIMEApplication(chat)
        attachment.add_header('Content-Disposition','attachment',filename="chat.txt")
        msg.attach(attachment)

    charset = "utf-8"

    msg_body = MIMEMultipart('alternative')
    msg_body.attach(MIMEText(body_text.encode(charset), 'plain', charset))
    msg_body.attach(MIMEText(body_html.encode(charset), 'html', charset))
    msg.attach(msg_body)
    
    boto3.client("ses").send_raw_email(
        Source=email_source,
        Destinations=email_destinations,
        RawMessage={
            'Data':msg.as_string(),
        }
    )
    print("Email sent!")

    exit()

async def initialize():

    start_command = "START"
    end_command = "END"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, 
            ignore_default_args=['--mute-audio'],
            args=[
                "--window-size=1000,1000",
                "--use-fake-ui-for-media-stream",
                "--disable-notifications",
                "--disable-extensions",
                "--disable-crash-reporter",
                "--disable-dev-shm-usage",
                "--no-sandbox"
            ]
        )
        page = await browser.new_page()
        page.set_default_timeout(20000)

        print("Getting meeting link.")
        print(f"https://zoom.us/wc/{os.environ['MEETING_ID'].replace(' ', '')}/join")
        print(os.environ['MEETING_PASSWORD'])
        await page.goto(f"https://zoom.us/wc/{os.environ['MEETING_ID'].replace(' ', '')}/join")

        print("Typing meeting password.")
        password_text_element = await page.wait_for_selector('#input-for-pwd')
        await password_text_element.type(os.environ['MEETING_PASSWORD'])

        print("Entering name.")
        name_text_element = await page.wait_for_selector('#input-for-name')
        await name_text_element.type(scribe_name)
        await name_text_element.press("Enter")

        print("Adding audio.")
        audio_button_element = await page.wait_for_selector(
            "text=Join Audio by Computer",
            timeout=3000000
        )
        await audio_button_element.click()

        print("Opening chat panel.")
        chat_button_element = await page.wait_for_selector(
            'button[aria-label^="open the chat panel"]'
        )
        await chat_button_element.hover()
        await chat_button_element.click()

        async def send_message(message):
            message_element = await page.wait_for_selector(
                'div[aria-placeholder="Type message here..."]'
            )
            await message_element.fill(message)
            await message_element.press('Enter')       

        print("Sending introduction messages.")
        await send_message(
            'Hello! I am an AI-assisted scribe for Amazon Chime. To learn more about me,'
            ' visit https://github.com/aws-samples/automated-meeting-scribe-and-summarizer.'
        )
        await send_message(
            f'If all attendees consent, send "{start_command}" in the chat'
            ' to save attendance, new messages and transcriptions.'
        )
        await send_message(
            f'Otherwise, send "{end_command}" in the chat to remove me from this meeting.'
        )

        async def speaker_change(speaker):
            global current_speaker
            current_speaker = speaker
            if speaker not in attendees:
                attendees.append(speaker)
            print('Speaker name changed:', speaker)

        await page.expose_function("speakerChange", speaker_change)

        async def start_transcription():
            await page.evaluate('''
                console.log("Hello there")
                const targetNode = document.querySelector(
                    '.speaker-active-container__video-frame .video-avatar__avatar .video-avatar__avatar-title'
                )
                const config = { childList: true, subtree: true }

                const callback = (mutationList, observer) => {
                    for (const mutation of mutationList) {
                        const speaker = mutation.target.textContent
                        if (speaker) {
                            speakerChange(speaker)
                        }
                    }
                }

                const observer = new MutationObserver(callback)
                observer.observe(targetNode, config)
            ''')
            global transcribe_task
            transcribe_task = asyncio.create_task(transcribe())

        async def message_change(message):
            print(message)      
            global start
            if end_command in message:
                leave_button_element = await page.wait_for_selector('button[aria-label="Leave"]')
                await leave_button_element.hover()
                await leave_button_element.click()
            elif not start and start_command in message:
                start = True
                start_message = 'Saving attendance, new messages and transcriptions.'
                print(start_message)
                await send_message(start_message)
                await start_transcription()
            elif start:
                messages.append(message)              

        await page.expose_function("messageChange", message_change)
        
        await page.evaluate('''
            const targetNode = document.querySelector('div[aria-label="Chat Message List"]')
            const config = { childList: true, subtree: true }

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    const addedNode = mutation.addedNodes[0]
                    if (addedNode) {
                        messageChange(
                            addedNode.querySelector('div[id^="chat-message-content"]').getAttribute('aria-label')
                        )  
                    }
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        async def meeting_end():
            global meeting_end
            try:
                done, pending = await asyncio.wait(
                    fs=[
                        asyncio.create_task(page.wait_for_selector('button[aria-label="Leave"]', state="detached", timeout=0)),
                        asyncio.create_task(page.wait_for_selector('div[class="zm-modal zm-modal-legacy"]', timeout=0))
                    ],
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=43200000
                )
                [task.cancel() for task in pending]
                print("Meeting ended.")
            except:
                print("Meeting timed out or something.")
            finally:
                meeting_end = True
        
        print("Waiting for meeting end.")
        await meeting_end()
        await browser.close()
        if start:
            await transcribe_task

asyncio.run(initialize())

deliver()