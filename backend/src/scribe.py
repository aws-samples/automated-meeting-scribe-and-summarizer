
import os
import asyncio
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
import sounddevice as sd
from datetime import datetime, timedelta
import bisect

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

email_sender = os.environ['EMAIL_SENDER']
email_receiver = os.environ['EMAIL_RECEIVER']

scribe_name = "Scribe"
scribe_identity = f"{scribe_name} ({email_receiver})"

waiting_timeout = 300000 # 5 minutes
meeting_timeout = 21600000 # 6 hours

start = False

start_command = "START"
pause_command = "PAUSE"
end_command = "END"

intro_messages = [
    ('Hello! I am an AI-assisted scribe. To learn more about me,'
    ' visit https://github.com/aws-samples/automated-meeting-scribe-and-summarizer.'),
    (f'If all participants consent to my use, send "{start_command}" in the chat'
    ' to start saving new speakers, messages, and machine-generated captions.'),
    (f'If you do not consent to my use, send "{end_command}" in the chat'
    ' to remove me from this meeting.')
]
start_messages = [
    'Saving new speakers, messages, and machine-generated captions.',
    f'Send "{pause_command}" in the chat to stop saving meeting details.'
]
pause_messages = [
    'Not saving speakers, messages, or machine-generated captions.',
    f'Send "{start_command}" in the chat to start saving meeting details.'
]

messages = []
attachments = {}
captions = []
speakers = []
speaker_timestamps = []

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        for result in results:
            if not result.is_partial:
                for item in result.alternatives[0].items:
                    timestamp = start_time + timedelta(seconds=item.start_time)
                    # print('Timestamp:', timestamp)
                    speaker = speakers[
                        bisect.bisect_right(speaker_timestamps, timestamp) - 1
                    ]
                    # print('Speaker:', speaker)
                    word = item.content
                    # print('Word:', word)
                    word_type = item.item_type
                    # print('Type:', word_type)
                    if captions:
                        if speaker in captions[-1].split(': ')[0]:
                            if word_type == "pronunciation":
                                captions[-1] += f" {word}"
                            elif word_type == "punctuation":
                                captions[-1] += word
                            continue
                    captions.append(f"[{timestamp.strftime('%H:%M')}] {speaker}: {word}")

async def write_audio(stream):
    loop = asyncio.get_event_loop()
    input_queue = asyncio.Queue()

    def callback(indata, frame_count, time_info, status):
        loop.call_soon_threadsafe(input_queue.put_nowait, (bytes(indata), status))

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
    global start_time
    start_time = datetime.now()

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
    speaker_timestamps.append(datetime.now())
    speakers.append(speaker)
    # print('New Speaker:', speaker)

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

def encapsulate():
    email_source = f"{scribe_name} <{'+scribe@'.join(email_sender.split('@'))}>"
    email_destinations = [email_receiver]
    
    msg = MIMEMultipart('mixed')
    msg['From'] = email_source
    msg['To'] = ', '.join(email_destinations)
    subject = meeting_name

    # print("Messages:", messages)
    # print("Attachments:", attachments)
    # print("Captions:", captions)
    # print("Speakers:", speakers)

    pii_exceptions = ['EMAIL', 'ADDRESS', 'NAME', 'PHONE', 'DATE_TIME', 'URL', 'AGE', 'USERNAME']
    chat = redact_pii('\n'.join(messages), pii_exceptions)
    transcript = redact_pii('\n\n'.join(captions), pii_exceptions)
    particpants = '\n'.join(set(speakers))

    # print("Chat:", chat)
    # print("Transcript:", transcript)   
    # print("Participants:", particpants)

    if chat: 
        attachment = MIMEApplication(chat)
        attachment.add_header('Content-Disposition','attachment',filename="chat.txt")
        msg.attach(attachment)        
      
    for file_name, link in attachments.items():
        attachment = MIMEApplication(requests.get(link).content)
        attachment.add_header('Content-Disposition','attachment',filename=file_name)
        msg.attach(attachment)   

    html = ""
    if transcript:
        prompt = (
            "Output a title in <title></title> tags, a summary in <summary></summary> tags, "
            "and a list of action items in <action items></action items> tags from the following transcript:"
            f"\n<transcript>{transcript}</transcript>"
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
            completion = json.loads(response.get("body").read())["content"][0]["text"]

            title = re.findall(r'<title>(.*?)</title>', completion, re.DOTALL)[0].strip()
            summary = re.findall(r'<summary>(.*?)</summary>', completion, re.DOTALL)[0].strip()
            action_items = re.findall(r'<action items>(.*?)</action items>', completion, re.DOTALL)[0].strip() 
        except Exception as exception:
            error_message = "Error while summarizing"
            print(f"{error_message}: {exception}")
            html = f"{error_message}. Check the logs for more information."
        else:
            subject = f"{meeting_name} | {title}"
            html = f"""
                <html>
                    <body>
                        <h4>Participants</h4>
                        <p>{particpants.replace('\n', '<br>')}</p>
                        <h4>Summary</h4>
                        <p>{summary.replace('\n', '<br>')}</p>
                        <h4>Action Items</h4>
                        <p>{action_items.replace('\n', '<br>')}</p>
                    </body>
                </html>
            """

        attachment = MIMEApplication(transcript)
        attachment.add_header('Content-Disposition','attachment',filename="transcript.txt")
        msg.attach(attachment)

    body = MIMEMultipart('alternative')
    charset = "utf-8"
    body.attach(MIMEText(html.encode(charset), 'html', charset))
    msg.attach(body)

    msg['Subject'] = subject

    boto3.client("ses").send_raw_email(
        Source=email_source,
        Destinations=email_destinations,
        RawMessage={
            'Data':msg.as_string(),
        }
    )
    print("Email sent!")
