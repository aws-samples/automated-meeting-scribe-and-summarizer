import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import {
    CreateScheduleCommand,
    DeleteScheduleCommand,
    SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { DynamoDBStreamEvent } from "aws-lambda";

const schedulerClient = new SchedulerClient();
const ecsClient = new ECSClient();

function lowercaseDictionary(obj: any): any {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            const newKey = key.charAt(0).toLowerCase() + key.slice(1);
            result[newKey] = lowercaseDictionary(value);
        }
        return result;
    } else if (Array.isArray(obj)) {
        return obj.map((item) => lowercaseDictionary(item));
    }
    return obj;
}

export const handler = async (event: DynamoDBStreamEvent) => {
    for (const record of event.Records) {
        const inviteId = record.dynamodb?.Keys?.id?.S;

        if (record.eventName === "INSERT" && record.dynamodb?.NewImage) {
            console.log("schedule");
            const invite = record.dynamodb.NewImage;
            const meetingDateTime = new Date(parseInt(invite.meetingTime.N!) * 1000);
            const delayMinutes = 2; // minutes

            const ecsParams = {
                ClientToken: inviteId,
                TaskDefinition: process.env.TASK_DEFINITION_ARN!,
                Cluster: process.env.CLUSTER_ARN!,
                LaunchType: "FARGATE",
                NetworkConfiguration: {
                    AwsvpcConfiguration: {
                        AssignPublicIp: "DISABLED",
                        SecurityGroups: JSON.parse(process.env.SECURITY_GROUPS!),
                        Subnets: JSON.parse(process.env.SUBNETS!),
                    },
                },
                Overrides: {
                    ContainerOverrides: [
                        {
                            Name: process.env.CONTAINER_ID!,
                            Environment: [
                                {
                                    Name: "GRAPH_API_URL",
                                    Value: process.env.GRAPH_API_URL!,
                                },
                                {
                                    Name: "INVITE_ID",
                                    Value: inviteId,
                                },
                                {
                                    Name: "EMAIL_SOURCE",
                                    Value: process.env.EMAIL_SOURCE!,
                                },
                                // {
                                //     Name: "VOCABULARY_NAME",
                                //     Value: process.env.VOCABULARY_NAME!,
                                // },
                            ],
                        },
                    ],
                },
                EnableExecuteCommand: false,
            };

            const delayMilliseconds = delayMinutes * 60 * 1000;
            if (meetingDateTime > new Date(new Date().getTime() + delayMilliseconds)) {
                console.log("later");
                const delayedTime = new Date(meetingDateTime.getTime() - delayMilliseconds);

                await schedulerClient.send(
                    new CreateScheduleCommand({
                        ActionAfterCompletion: "NONE",
                        FlexibleTimeWindow: { Mode: "OFF" },
                        GroupName: process.env.SCHEDULE_GROUP!,
                        Name: inviteId,
                        ScheduleExpression: `at(${delayedTime.toISOString().slice(0, 19)})`,
                        ScheduleExpressionTimezone: "UTC",
                        State: "ENABLED",
                        Target: {
                            Arn: "arn:aws:scheduler:::aws-sdk:ecs:runTask",
                            RoleArn: process.env.SCHEDULER_ROLE_ARN!,
                            Input: JSON.stringify(ecsParams),
                        },
                    })
                );
            } else {
                console.log("now");
                await ecsClient.send(new RunTaskCommand(lowercaseDictionary(ecsParams)));
            }
        } else if (record.eventName === "REMOVE") {
            console.log("unschedule");
            await schedulerClient.send(
                new DeleteScheduleCommand({
                    GroupName: process.env.SCHEDULE_GROUP!,
                    Name: inviteId,
                })
            );
        }
    }

    return { statusCode: 200, body: "Success" };
};
