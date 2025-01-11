from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
import json
import os
import boto3
from boto3.dynamodb.conditions import Attr, Key
from time import time

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
expiration_seconds = 60 * 5  # 5 minutes


@app.resolver(type_name="Mutation", field_name="createInvite")
def create_invite(input):
    email = app.current_event.identity.claims.get("email")
    meeting_time = input["meeting"]["time"]
    meeting = "#".join(
        [
            input["meeting"]["platform"],
            input["meeting"]["id"],
            input["meeting"]["password"],
            str(meeting_time),
        ]
    )
    with open("names.json", "r") as file:
        names = json.load(file)
    scribe_name = names[hash(meeting.encode()) % len(names)]

    logger.info("posting")
    table.put_item(
        Item={
            "pk": email,
            "sk": meeting,
            "meeting_expiration": (meeting_time + expiration_seconds),
            "meeting_name": input["name"],
            "scribe_name": scribe_name,
            "scribe_status": "Scheduled",
        }
    )

    return f"{input['name']} invite created!"


@app.resolver(type_name="Query", field_name="getInvites")
def get_invites():
    email = app.current_event.identity.claims.get("email")
    logger.info("getting")
    response = table.query(
        KeyConditionExpression=Key("pk").eq(email),
        FilterExpression=Attr("meeting_expiration").gte(
            int(time()) + expiration_seconds - 300  # 5 minutes
        ),
    )
    meetings = [
        {
            "name": item["meeting_name"],
            "meeting": {
                "platform": item["sk"].split("#")[0],
                "id": item["sk"].split("#")[1],
                "password": item["sk"].split("#")[2],
                "time": item["sk"].split("#")[3],
            },
            "scribe": item["scribe_name"],
            "status": item["scribe_status"],
        }
        for item in response["Items"]
    ]

    return meetings


@app.resolver(type_name="Mutation", field_name="deleteInvite")
def delete_invite(input):
    email = app.current_event.identity.claims.get("email")

    meeting = "#".join(
        [
            input["platform"],
            input["id"],
            input["password"],
            str(input["time"]),
        ]
    )

    logger.info("deleting")
    table.delete_item(Key={"pk": email, "sk": meeting})

    return "Invite deleted successfully!"


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
