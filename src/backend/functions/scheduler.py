import json
import os
import re
import logging
from datetime import datetime, timedelta, timezone
import boto3


def lowercase_dictionary(object):
    if isinstance(object, dict):
        return {
            (key[0].lower() + key[1:]): lowercase_dictionary(value)
            for key, value in object.items()
        }
    elif isinstance(object, list):
        return [lowercase_dictionary(value) for value in object]
    else:
        return object


def handler(event, context):
    record = event["Records"][0]
    event_name = record["eventName"]

    username = record["dynamodb"]["Keys"]["pk"]["S"]
    meeting = record["dynamodb"]["Keys"]["sk"]["S"]
    meeting_platform, meeting_id, meeting_password, meeting_time = meeting.split("#")

    scheduler_client = boto3.client("scheduler")
    schedule_name = re.sub(r"[^0-9a-zA-Z-_.]", "", username + meeting)
    logging.info(schedule_name)

    if event_name == "INSERT":
        logging.info("schedule")
        meeting_datetime = datetime.fromtimestamp(int(meeting_time), tz=timezone.utc)
        delay = 2
        ecs_params = {
            "ClientToken": meeting,
            "TaskDefinition": os.environ["TASK_DEFINITION_ARN"],
            "Cluster": os.environ["ECS_CLUSTER_ARN"],
            "LaunchType": "FARGATE",
            "NetworkConfiguration": {
                "AwsvpcConfiguration": {
                    "AssignPublicIp": "DISABLED",
                    "SecurityGroups": json.loads(os.environ["SECURITY_GROUPS"]),
                    "Subnets": json.loads(os.environ["SUBNETS"]),
                }
            },
            "Overrides": {
                "ContainerOverrides": [
                    {
                        "Name": os.environ["CONTAINER_ID"],
                        "Environment": [
                            {
                                "Name": "SCRIBE_NAME",
                                "Value": record["dynamodb"]["NewImage"]["scribe_name"][
                                    "S"
                                ],
                            },
                            {"Name": "TABLE", "Value": os.environ["TABLE_NAME"]},
                            {
                                "Name": "MEETING_INDEX",
                                "Value": os.environ["MEETING_INDEX"],
                            },
                            {"Name": "MEETING", "Value": meeting},
                            {
                                "Name": "EMAIL_SOURCE",
                                "Value": os.environ["EMAIL_SOURCE"],
                            },
                            # {
                            #     "Name": "VOCABULARY_NAME",
                            #     "Value": os.environ["VOCABULARY_NAME"],
                            # },
                        ],
                    }
                ]
            },
            "EnableExecuteCommand": False,
        }
        if meeting_datetime > datetime.now(timezone.utc) + timedelta(minutes=delay):
            logging.info("later")
            delayed_time = meeting_datetime - timedelta(minutes=delay)
            scheduler_client.create_schedule(
                ActionAfterCompletion="NONE",
                FlexibleTimeWindow={"Mode": "OFF"},
                GroupName=os.environ["SCHEDULE_GROUP"],
                Name=schedule_name,
                ScheduleExpression=f"at({delayed_time.strftime('%Y-%m-%dT%H:%M:%S')})",
                ScheduleExpressionTimezone="UTC",
                State="ENABLED",
                Target={
                    "Arn": "arn:aws:scheduler:::aws-sdk:ecs:runTask",
                    "RoleArn": os.environ["SCHEDULER_ROLE_ARN"],
                    "Input": json.dumps(ecs_params),
                },
            )
        else:
            logging.info("now")
            boto3.client("ecs").run_task(**lowercase_dictionary(ecs_params))

    elif event_name == "REMOVE":
        logging.info("unschedule")
        scheduler_client.delete_schedule(
            GroupName=os.environ["SCHEDULE_GROUP"],
            Name=schedule_name,
        )

    return {"statusCode": 200, "body": "Success"}
