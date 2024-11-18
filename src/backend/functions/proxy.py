from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.event_handler.api_gateway import CORSConfig
from aws_lambda_powertools.utilities.typing import LambdaContext
import json
import os
import boto3
from boto3.dynamodb.conditions import Attr, Key
from time import time

logger = Logger()
app = APIGatewayRestResolver(
    cors=CORSConfig(
        allow_origin="",
        extra_origins=json.loads(os.environ["ALLOWED_ORIGINS"]),
        allow_credentials=True,
    )
)
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
expiration_seconds = 2592000  # 30 days


@app.post("/post-invite")
def post_invite():
    email = app.current_event.request_context.authorizer.claims.get("email")
    data = app.current_event.json_body
    meeting_time = data["time"]
    meeting = "#".join(
        [
            data["platform"],
            data["id"],
            data["password"],
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
            "meeting_name": data["name"],
            "scribe_name": scribe_name,
        }
    )

    return {"type": "success", "content": f"{data['name']} invite created!"}


@app.get("/get-invites")
def get_invites():
    email = app.current_event.request_context.authorizer.claims.get("email")
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
            "platform": item["sk"].split("#")[0],
            "id": item["sk"].split("#")[1],
            "password": item["sk"].split("#")[2],
            "time": item["sk"].split("#")[3],
            "scribe": item["scribe_name"],
        }
        for item in response["Items"]
    ]

    return {
        "type": "success",
        "content": "Got invites successfully!",
        "invites": meetings,
    }


@app.delete("/delete-invites")
def delete_invites():
    email = app.current_event.request_context.authorizer.claims.get("email")
    for data in app.current_event.json_body:
        meeting = "#".join(
            [
                data["platform"],
                data["id"],
                data["password"],
                str(data["time"]),
            ]
        )
        logger.info("deleting")
        table.delete_item(Key={"pk": email, "sk": meeting})

    return {"status": "success", "content": "Selected invite(s) deleted!"}


@app.post("/query-meetings")
def query_meetings():
    email = app.current_event.request_context.authorizer.claims.get("email")
    logger.info("getting")
    invites = table.query(KeyConditionExpression=Key("pk").eq(email))["Items"]
    meetings = [invite["sk"] for invite in invites]

    try:
        text = boto3.client("bedrock-agent-runtime").retrieve_and_generate(
            input={"text": app.current_event.json_body},
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": os.environ["KNOWLEDGE_BASE_ID"],
                    "modelArn": f"arn:aws:bedrock:{os.environ["AWS_REGION"]}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
                    "retrievalConfiguration": {
                        "vectorSearchConfiguration": {
                            "numberOfResults": 5,
                            "filter": {"in": {"key": "meeting", "value": meetings}},
                        }
                    },
                },
            },
        )["output"]["text"]
        return {"type": "success", "content": text}
    except Exception as exception:
        logger.error(exception)
        return {"type": "error", "content": "You have no meetings."}


@logger.inject_lambda_context
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
