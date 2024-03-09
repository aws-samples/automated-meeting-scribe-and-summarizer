
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoSuchElementException
from selenium.common.exceptions import StaleElementReferenceException
import os
from time import sleep
from datetime import datetime
import boto3
import json
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import requests

options = Options()
options.add_argument("headless=new")
options.add_argument("window-size=7680,4320")
options.add_argument("use-fake-ui-for-media-stream")
options.add_argument("disable-notifications")
options.add_argument("disable-extensions")
options.add_argument("no-sandbox")
driver = Chrome(options=options)
wait = WebDriverWait(driver, 10)

scribe_name = "Scribe Bot"
email_address = os.environ['EMAIL']
scribe_identity = f"{scribe_name} ({email_address})"

start_command = "SCRIBE START"
anonymize_command = "SCRIBE ANONYMIZE"
end_command = "SCRIBE END"
skipped_messages = 0
prev_sender = ""
start = False
anonymize = False

# Deliverables
attendees = []
messages = []
attachments = {}
captions = []

def send_message(message):

    message_element = wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR,
        'textarea[placeholder="Message all attendees"]',
    )))
    message_element.send_keys(message)
    message_element.submit()

def initialize():

    print("Getting meeting link.")
    driver.get(f"https://app.chime.aws/meetings/{os.environ["MEETING_ID"]}")

    print("Entering scribe name.")
    identity_element = wait.until(EC.element_to_be_clickable((By.ID, "name")))
    identity_element.send_keys(scribe_identity)
    identity_element.submit()

    print("Clicking second join meeting button.")
    wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR, 
        'button[data-testid="button"][aria-label="Join"]'
    ))).click()

    wait_time = 300
    print(f"Waiting {wait_time} seconds to open chat panel.")
    try:
        WebDriverWait(driver, wait_time).until(EC.element_to_be_clickable((
            By.CSS_SELECTOR, 
            'button[data-testid="button"][aria-label^="Open chat panel"]'
        ))).click()
    except:
        print("Unable to join meeting.")
        driver.quit()
        exit()

    print("Sending introduction message.")
    send_message(
        'Hello! I am an AI-assisted meeting scribe. To learn more about me,' \
            + ' visit https://github.com/aws-samples/automated-meeting-scribe-and-summarizer.' \
            + ' If all attendees consent to my use,' \
            + f' send "{start_command}" in the chat to save new messages and machine-generated captions.' \
            + ' I redact sensitive personally identifiable information by default,' \
            + ' however, if you would like further anonymity,' \
            + f' send "{anonymize_command}" in the chat to also redact emails, addresses, phone numbers, and names.' \
            + f' Send "{end_command}" to remove me from this meeting at any point.'
    )

    print("Opening attendees panel.")
    wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR,
        'button[data-testid="button"][aria-label^="Open attendees panel"]',
    ))).click()

    print("Clicking media layout button.")
    wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR,
        'button[data-testid="popover-toggle"][aria-label="Media layout"]',
    ))).click()

    print("Hiding all available video.")
    wait.until(EC.element_to_be_clickable((
        By.XPATH, 
        '//span[text()="Hide all available video"]'
    ))).click()

def scrape_attendees():

    container_elements = driver.find_element(
        By.CLASS_NAME, "_2WpDbs_A8dLAno6BVxx-fC"
    ).find_elements(
        By.CLASS_NAME, "_1IEUbelvxVpEblfF0Mula8"
    )
    for container_element in reversed(container_elements):
        status = container_element.find_element(
            By.CLASS_NAME, '_2BApI7hT-7sOhO4W1zO9l8'
        ).text

        cell_elements = container_element.find_elements(By.CLASS_NAME, "_1_UUAcglOhxMMdQS4BcyLq")

        if status == "Present" and len(cell_elements) == 1:
            deliver()

        for cell_element in cell_elements:
            name_element = cell_element.find_element(
                By.CLASS_NAME, 'ppi5x8cvVEQgbl_hLeiRW'
            )
            name = name_element.text

            cell_element.find_element(
                By.CSS_SELECTOR, 
                "button[data-testid='popover-toggle']"
            ).click()
            try:
                email = WebDriverWait(driver, .1).until(
                    EC.presence_of_element_located((
                        By.CLASS_NAME, '_3ZBWxY2tbvCqtfl0RHn0d'
                    ))
                ).text
            except TimeoutException:
                email = ""
            name_element.click()

            attendee = next(
                (attendee for attendee in attendees if attendee["Name"] == name and attendee["Email"] == email), 
                None
            )
            if not attendee:
                if name != f"‹{scribe_identity}›":
                    if status == "Present":
                        join_time = datetime.now()
                    else: 
                        join_time = ""

                    attendees.append({
                        "Name": name,
                        "Email": email,
                        "LastStatus": status,
                        "Joined": join_time,
                        "Left": ""
                    })
            elif attendee["LastStatus"] != status:
                if status == "Present":
                    attendee["Left"] = ""
                    if not attendee["Joined"]:
                        attendee["Joined"] = datetime.now()
                elif status in ["Left", "Dropped"]:
                    attendee["Left"] = datetime.now()                      
                attendee["LastStatus"] = status

def initialize_captions():

    print("Turning on machine-generated captions.")
    wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR,
        'button[data-testid="button"][aria-label="Turn on machine generated captions"]',
    ))).click()

    print("Clicking language preference confirmation button.")
    wait.until(EC.element_to_be_clickable((
        By.CSS_SELECTOR,
        'button[data-testid="closedCaptionsOkButton"][aria-label="Ok"]',
    ))).click() 

def scrape_messages():

    global skipped_messages
    global prev_sender
    global start
    global anonymize
    end = False

    message_elements = driver.find_elements(By.CLASS_NAME, "chatMessage")
    chat_length = skipped_messages + len(messages)

    for message_element in message_elements[chat_length:]:
        try:
            sender = message_element.find_element(
                By.CSS_SELECTOR, "h3[data-testid='chat-bubble-sender-name']"
            ).text
        except NoSuchElementException:
            sender = prev_sender
        prev_sender = sender

        text = message_element.find_element(By.CLASS_NAME, "Linkify").text

        if text == start_command:
            initialize_captions()
            start = True
            start_message = "Saving new messages and machine-generated captions."
            send_message(start_message)
            print(start_message)
        elif text == anonymize_command:
            anonymize = True
            anonymize_message = "Redacting emails, addresses, phone numbers, and names."
            send_message(anonymize_message)
            print(anonymize_message)
        elif text == end_command:
            end = True

        if not start:
            skipped_messages += 1
        else: 
            try:
                attachment_element = message_element.find_element(
                    By.CLASS_NAME, "SLFfm3Dwo5MfFzks4uM11"
                )
            except NoSuchElementException:
                attachment_element = None

            if attachment_element:
                file_name = attachment_element.get_attribute("title")
                attachments[file_name] = attachment_element.get_attribute("href")
                if text:
                    message = f"{sender}: {text} | {file_name}"
                else:
                    message = f"{sender}: {file_name}"
            else:
                message = f"{sender}: {text}"

            messages.append(message)

        if end: 
            deliver()

def scrape_captions():

    style = "arguments[0].style.height = '2160px';"
    wait = WebDriverWait(driver, 1)
    driver.execute_script(
        style, 
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "_2-8_ZrXXCnixJb26a4JMjO")))
    )
    driver.execute_script(
        style, 
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "_1bqBOFA5PPIrx5PUq9uxyl")))
    )

    speaker_elements = driver.find_elements(By.CLASS_NAME, "_3512TwqLzPaGGAWp_8W1se")
    text_elements = driver.find_elements(By.CLASS_NAME, "_1XM7bRv8y86tbk7HmDvoj7")

    speaker_name = driver.find_element(
        By.CLASS_NAME, 'activeSpeakerCell'
    ).find_element(
        By.CLASS_NAME, 'ppi5x8cvVEQgbl_hLeiRW'
    ).text
    if speaker_name == "No one":
        caption_elements = list(zip(speaker_elements, text_elements))
    else:
        caption_elements = list(zip(speaker_elements, text_elements))[:-min(len(attendees), 4)]

    for speaker_element, text_element in caption_elements:
        speaker = speaker_element.text
        if speaker:
            text = text_element.text
            if text not in '\n'.join(captions[-20:]):
                if captions:
                    previous_speaker, previous_text = captions[-1].split(': ', 1)
                    if speaker == previous_speaker:
                        captions[-1] = f"{previous_speaker}: {previous_text} {text}"
                        continue
                captions.append(f"{speaker}: {text}")

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

    try:
        driver.find_element(
            By.CSS_SELECTOR, 
            'button[data-testid="button"][aria-label^="Leave meeting"]'
        ).click()
    except NoSuchElementException:
        pass

    print("Meeting ended or scribe was removed.")

    attendance = ""
    chat = '\n'.join(messages)
    transcript = '\n\n'.join(captions)
    time_now = datetime.now()

    for index, attendee in enumerate(sorted(attendees, key=lambda k: k['Name'])):
        attendee_name = attendee["Name"]
        if anonymize:
            attendee_label = f"Attendee {index + 1}"
            attendance += attendee_label
            chat = chat.replace(attendee_name, attendee_label)
            transcript = transcript.replace(attendee_name, attendee_label)    
        else: 
            attendance += attendee_name
            if attendee["Email"]:
                attendance += f" ({attendee['Email']})"

        if attendee["Joined"]:
            if not attendee["Left"]:
                attendee["Left"] = time_now
            difference = attendee["Left"] - attendee["Joined"]
            attendance += f" | {round(difference.total_seconds()/60)} minutes\n"
        else: 
            attendance += f" | Invited\n"

    if not anonymize:
        pii_exceptions = ['EMAIL', 'ADDRESS', 'NAME', 'PHONE', 'DATE_TIME', 'URL', 'AGE', 'USERNAME']
    else:
        pii_exceptions = ['DATE_TIME', 'URL', 'AGE']

    chat = redact_pii(chat, pii_exceptions)
    transcript = redact_pii(transcript, pii_exceptions)

    prompt = f"""Please create a title, summary, and list of action items from the following transcript:
    <transcript>{transcript}</transcript>
    Please output the title in <title></title> tags, the summary in <summary></summary> tags, and the action items in <action items></action items> tags."""
    body = json.dumps({
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
        "anthropic_version": "bedrock-2023-05-31"
    })
    try: 
        response = boto3.client("bedrock-runtime").invoke_model(body=body, modelId="anthropic.claude-3-sonnet-20240229-v1:0")
        bedrock_completion = json.loads(response.get("body").read())["content"][0]["text"]
    except Exception as ex:
        print(f"Error while invoking model: {ex}")
        bedrock_completion = ""
        
    title = re.findall(r'<title>(.*?)</title>|$', bedrock_completion, re.DOTALL)[0].strip()
    summary = re.findall(r'<summary>(.*?)</summary>|$', bedrock_completion, re.DOTALL)[0].strip()
    action_items = re.findall(r'<action items>(.*?)</action items>|$', bedrock_completion, re.DOTALL)[0].strip()   

    email_source = f"{scribe_name} <{'+scribe@'.join(email_address.split('@'))}>"
    email_destinations = [email_address]

    body_text = "Attendees:\n" + attendance + "\nSummary:\n" + summary \
        + "\n\nAction Items:\n" + action_items + "\n\nChat:\n" + chat
    body_html = f"""
    <html>
        <body>
            <h4>Attendees</h4>
                <p>{attendance.replace('\n', '<br>')}</p>
            <h4>Summary</h4>
                <p>{summary.replace('\n', '<br>')}</p>
            <h4>Action Items</h4>
                <p>{action_items.replace('\n', '<br>')}</p>
            <h4>Chat</h4>
                <p>{chat.replace('\n', '<br>')}</p>
        </body>
    </html>
    """
    charset = "utf-8"

    msg = MIMEMultipart('mixed')
    msg['From'] = email_source
    msg['To'] = ', '.join(email_destinations)
    msg['Subject'] = f"{os.environ['MEETING_NAME']} | {title}"

    msg_body = MIMEMultipart('alternative')
    msg_body.attach(MIMEText(body_text.encode(charset), 'plain', charset))
    msg_body.attach(MIMEText(body_html.encode(charset), 'html', charset))
    msg.attach(msg_body)

    attachment = MIMEApplication(transcript)
    attachment.add_header('Content-Disposition','attachment',filename="transcript.txt")
    msg.attach(attachment)

    for file_name, link in attachments.items():
        attachment = MIMEApplication(requests.get(link).content)
        attachment.add_header('Content-Disposition','attachment',filename=file_name)
        msg.attach(attachment)
    
    try:
        boto3.client("ses").send_raw_email(
            Source=email_source,
            Destinations=email_destinations,
            RawMessage={
                'Data':msg.as_string(),
            }
        )
        print("Deliverables sent.")
    except Exception as ex:
        print(f"Error while sending deliverables: {ex}")

    driver.quit()
    exit()

initialize()

print("Scraping...")
iteration_count = 0
while True:
    if driver.find_elements(By.XPATH, '//span[text()="Your meeting has ended."] | //span[text()="You have been removed from this meeting."]'):
        deliver()

    sleep(3)
    
    try:
        if iteration_count % 10  == 0:
            scrape_attendees()
        scrape_messages()
        if start:
            scrape_captions()
    except StaleElementReferenceException:
        pass
    except Exception as ex:
        print(f"Error while scraping: {ex}")

    iteration_count += 1
