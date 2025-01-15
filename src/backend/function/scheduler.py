import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes import (
    event_source,
    DynamoDBStreamEvent,
)
from aws_lambda_powertools.utilities.typing import LambdaContext
from datetime import datetime, timedelta, timezone
import os
import json

logging = Logger()
scheduler_client = boto3.client("scheduler")
ecs_client = boto3.client("ecs")


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

        invite_id = record.dynamodb.keys["id"]

        if record.event_name.INSERT and record.dynamodb.new_image:
            logging.info("schedule")
            invite = record.dynamodb.new_image
            meeting_datetime = datetime.fromtimestamp(
                int(invite["meetingTime"]), tz=timezone.utc
            )
            delay = 2
            ecs_params = {
                "ClientToken": invite_id,
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
                                {
                                    "Name": "GRAPH_API_URL",
                                    "Value": os.environ["GRAPH_API_URL"],
                                },
                                {
                                    "Name": "INVITE_ID",
                                    "Value": invite_id,
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
                    Name=invite_id,
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
                ecs_client.run_task(**lowercase_dictionary(ecs_params))

        elif record.event_name.REMOVE:
            logging.info("unschedule")
            scheduler_client.delete_schedule(
                GroupName=os.environ["SCHEDULE_GROUP"],
                Name=invite_id,
            )

        return {"statusCode": 200, "body": "Success"}
