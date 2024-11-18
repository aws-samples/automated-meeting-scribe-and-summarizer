import os
from datetime import datetime, timezone
from time import sleep
import boto3
from boto3.dynamodb.conditions import Key

meeting = os.environ["MEETING"]
# print(meeting)
meeting_platform, meeting_id, meeting_password, meeting_time = meeting.split("#")

datetime_difference = datetime.fromtimestamp(
    int(meeting_time), tz=timezone.utc
) - datetime.now(timezone.utc)
second_difference = max(0, datetime_difference.total_seconds() - 10)
print(f"Sleeping {second_difference} seconds.")
sleep(second_difference)

scribe_name = os.environ["SCRIBE_NAME"]
scribe_identity = f"Scribe [{scribe_name}]"

response = (
    boto3.resource("dynamodb")
    .Table(os.environ["TABLE"])
    .query(
        IndexName=os.environ["MEETING_INDEX"],
        KeyConditionExpression=Key("sk").eq(meeting),
        ProjectionExpression="pk, meeting_name",
    )
)
email_destinations = [item["pk"] for item in response["Items"]]
if len(email_destinations) == 1:
    email_strings = email_destinations[0]
elif len(email_destinations) == 2:
    email_strings = f"{email_destinations[0]} and {email_destinations[1]}"
else:
    email_strings = (
        ", ".join(email_destinations[:-1]) + f", and {email_destinations[-1]}"
    )
meeting_names = [item["meeting_name"] for item in response["Items"]]

waiting_timeout = 300000  # 5 minutes
meeting_timeout = 21600000  # 6 hours

start = False

start_command = "START"
pause_command = "PAUSE"
end_command = "END"

intro_messages = [
    (f"Hello! I am Amazon's AI-assisted scribe. I was invited by {email_strings}."),
    (
        f'If all other participants consent to my use, send "{start_command}" in the chat'
        " to start saving new speakers, messages, and machine-generated captions."
    ),
    (
        f'If you do not consent to my use, send "{end_command}" in the chat'
        " to remove me from this meeting."
    ),
]
start_messages = [
    "Saving new speakers, messages, and machine-generated captions.",
    f'Send "{pause_command}" in the chat to stop saving meeting details.',
]
pause_messages = [
    "Not saving speakers, messages, or machine-generated captions.",
    f'Send "{start_command}" in the chat to start saving meeting details.',
]

messages = []
attachments = {}
captions = []
speakers = []
