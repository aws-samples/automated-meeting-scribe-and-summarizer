import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes import (
    event_source,
    DynamoDBStreamEvent,
)
from aws_lambda_powertools.utilities.typing import LambdaContext
import os
import json
from datetime import datetime, timedelta, timezone

logging = Logger(service="meeting-scheduler")
scheduler_client = boto3.client("scheduler")


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


@event_source(data_class=DynamoDBStreamEvent)
def handler(event: DynamoDBStreamEvent, context: LambdaContext):
    for record in event.records:

        uid = record.dynamodb.keys["uid"]

        if record.event_name.INSERT and record.dynamodb.new_image:
            logging.info("schedule")
            meeting = record.dynamodb.new_image
            meeting_datetime = datetime.fromtimestamp(
                int(meeting["time"]), tz=timezone.utc
            )
            delay = 2
            ecs_params = {
                "ClientToken": uid,
                "TaskDefinition": os.environ["TASK_DEFINITION_ARN"],
                "Cluster": os.environ["CLUSTER_ARN"],
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
                                # {
                                #     "Name": "GRAPH_API_URL",
                                #     "Value": os.environ["GRAPH_API_URL"],
                                # },
                                {
                                    "Name": "TABLE_NAME",
                                    "Value": os.environ["TABLE_NAME"],
                                },
                                {
                                    "Name": "MEETING_UID",
                                    "Value": meeting["uid"],
                                },
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
                    Name=uid,
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

        elif record.event_name.REMOVE:
            logging.info("unschedule")
            scheduler_client.delete_schedule(
                GroupName=os.environ["SCHEDULE_GROUP"],
                Name=uid,
            )

        return {"statusCode": 200, "body": "Success"}
