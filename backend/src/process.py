
import details
import boto3
import requests
import re
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logs_message = "Check the CloudWatch logs for more information."

def redact_pii(text: str, pii_exceptions):
    if text:
        text_copy = text
        response = boto3.client('comprehend').detect_pii_entities(Text=text_copy, LanguageCode='en')
        for entity in response['Entities']:
            entity_type = entity['Type']
            if entity_type not in pii_exceptions and entity['Score'] >= .999:
                pii = text_copy[entity['BeginOffset']:entity['EndOffset']]
                text = text.replace(pii, f"[{entity_type}]")

    return text

def summarize(transcript):
    system_prompt = (
        "You are an AI assistant tasked with outputting meeting notes from a transcript. "
        "Your notes should capture all relevant details from the meeting "
        "in a concise and clear manner."
    )
    # print(system_prompt)
    prompt = (
        "You will be outputting meeting notes from this transcript:\n"
        f"<transcript>{transcript}</transcript>\n\n"
        "For each unique topic of discussion, you should output the following items:\n"
        "1. A title for the discussion topic\n"
        "2. A list of speakers who participated in the topic's discussion\n"
        "3. A comprehensive summary of the topic's discussion\n"
        "4. A list of next steps or action items from the topic's discussion\n\n"
        "You may omit an item if there is not enough information for it.\n\n"
        "Format your output in HTML, using the following guidelines:\n"
        "- Use <html> tags.\n"
        "- Use <section> tags for topics.\n"
        "- Use <h3> tags for topic titles.\n"
        "- Use <h4> tags for item headings (Speakers, Summary, Next Steps).\n"
        "- Use <p> tags for summaries.\n"
        "- Use <ul> and <li> tags for lists."
    )
    # print(prompt)
    try: 
        response = boto3.client("bedrock-runtime").converse(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={
                "maxTokens": 4096,
                "temperature": 0.9,
                "topP": 0.2
            }
        )["output"]["message"]["content"][0]["text"]
        # print(response)
        html = re.findall(r'<html>(.*?)</html>', response, re.DOTALL)[0].strip()
    except Exception as exception:
        error_message = "Error while outputting meeting notes"
        print(f"{error_message}: {exception}")
        html = f"{error_message}. {logs_message}"

    # print(html)
    return html

def email(chat, attachments: dict, transcript):
    email_source = f"{details.scribe_name} <{'+scribe@'.join(details.email_sender.split('@'))}>"
    email_destinations = [details.email_receiver]
    
    msg = MIMEMultipart('mixed')
    msg['From'] = email_source
    msg['To'] = ', '.join(email_destinations)
    msg['Subject'] = details.meeting_name

    if chat: 
        attachment = MIMEApplication(chat)
        attachment.add_header('Content-Disposition','attachment',filename="chat.txt")
        msg.attach(attachment)        
      
    for file_name, link in attachments.items():
        attachment = MIMEApplication(requests.get(link).content)
        attachment.add_header('Content-Disposition','attachment',filename=file_name)
        msg.attach(attachment)   

    if transcript:
        attachment = MIMEApplication(transcript)
        attachment.add_header('Content-Disposition','attachment',filename="transcript.txt")
        msg.attach(attachment)

        html = summarize(transcript)
    else:
        html = f"Your transcript was empty. {logs_message}"

    body = MIMEMultipart('alternative')
    charset = "utf-8"
    body.attach(MIMEText(html.encode(charset), 'html', charset))
    msg.attach(body)

    boto3.client("ses").send_raw_email(
        Source=email_source,
        Destinations=email_destinations,
        RawMessage={
            'Data':msg.as_string(),
        }
    )
    print("Email sent!")

def encapsulate():
    # print("Messages:", details.messages)
    # print("Attachments:", details.attachments)
    # print("Captions:", details.captions)
    # print("Speakers:", details.speakers)

    pii_exceptions = ['EMAIL', 'ADDRESS', 'NAME', 'PHONE', 'DATE_TIME', 'URL', 'AGE', 'USERNAME']
    chat = redact_pii('\n'.join(details.messages), pii_exceptions)
    transcript = redact_pii('\n\n'.join(details.captions), pii_exceptions)

    # print("Chat:", chat)
    # print("Transcript:", transcript)   

    email(chat=chat, attachments=details.attachments, transcript=transcript)
