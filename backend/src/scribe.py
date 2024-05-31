
import os
import asyncio
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
import sounddevice as sd
import string

import boto3
import json
import re
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests

meeting_platform = os.environ['MEETING_PLATFORM']
meeting_id = os.environ['MEETING_ID']
meeting_password = os.environ['MEETING_PASSWORD']
meeting_name = os.environ['MEETING_NAME']

scribe_name = "Scribe"
email_address = os.environ['EMAIL']
scribe_identity = f"{scribe_name} ({email_address})"

waiting_timeout = 3000000
meeting_timeout = 43200000

start_command = "START"
pause_command = "PAUSE"
end_command = "END"

intro_messages = [
    ('Hello! I am an AI-assisted scribe. To learn more about me,'
    ' visit https://github.com/aws-samples/automated-meeting-scribe-and-summarizer.'),
    (f'If all attendees consent to my use, send "{start_command}" in the chat'
    ' to start saving attendance, new messages and machine-generated captions.'),
    (f'If you do not consent to my use, send "{end_command}" in the chat'
    ' to remove me from this meeting.')
]

start = False

start_messages = [
    'Saving attendance, new messages and machine-generated captions.',
    f'Send "{pause_command}" in the chat to stop saving meeting details.'
]
pause_messages = [
    'Not saving attendance, new messages or machine-generated captions.',
    f'Send "{start_command}" in the chat to start saving meeting details.'
]

attendees = []
messages = []
attachments = {}
captions = []
speakers = []

current_speaker = "First Speaker"

def baseline_text(text: str):
    return text.lower().translate(str.maketrans('', '', string.punctuation))

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        for result in results:
            for alt in result.alternatives:
                caption = alt.transcript
                # print('New Caption:', caption)
                if captions:
                    if baseline_text(captions[-1]) in baseline_text(caption):
                        captions[-1] = caption
                        continue
                captions.append(caption)
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
    ):
        while start:
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

async def speaker_change(speaker):
    # print('New Speaker:', speaker)
    global current_speaker
    current_speaker = speaker
    if speaker not in attendees:
        attendees.append(speaker) 

def redact_pii(text, pii_exceptions):

    if text:
        text_copy = text
        response = boto3.client('comprehend').detect_pii_entities(Text=text_copy, LanguageCode='en')
        for entity in response['Entities']:
            entity_type = entity['Type']
            if entity_type not in pii_exceptions and entity['Score'] >= .999:
                pii = text_copy[entity['BeginOffset']:entity['EndOffset']]
                text = text.replace(pii, f"[{entity_type}]")

    return text

def deliver():

    # print(attendees)
    # print(messages)
    # print(attachments)
    # print(captions)
    # print(speakers)

    email_source = f"{scribe_name} <{'+scribe@'.join(email_address.split('@'))}>"
    email_destinations = [email_address]

    msg = MIMEMultipart('mixed')
    msg['From'] = email_source
    msg['To'] = ', '.join(email_destinations)

    if not (captions or messages):
        msg['Subject'] = meeting_name
        end_message = "No meeting details were saved."
        print(end_message)
        body_html = body_text = end_message
    else:
        attendance = '\n'.join(attendees)
        chat = '\n'.join(messages)
        transcriptions = [f"{speaker}: {caption}" for speaker, caption in zip(speakers, captions)]
        transcript = '\n\n'.join(transcriptions)

        pii_exceptions = ['EMAIL', 'ADDRESS', 'NAME', 'PHONE', 'DATE_TIME', 'URL', 'AGE', 'USERNAME']
        chat = redact_pii(chat, pii_exceptions)
        transcript = redact_pii(transcript, pii_exceptions)

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

        msg['Subject'] = f"{meeting_name} | {title}"

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

        for file_name, link in attachments.items():
            attachment = MIMEApplication(requests.get(link).content)
            attachment.add_header('Content-Disposition','attachment',filename=file_name)
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
