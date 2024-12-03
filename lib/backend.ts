
import {
    StackProps,
    aws_ses as ses,
    aws_dynamodb as dynamodb,
    Stack,
    aws_ec2 as ec2,
    aws_logs as logs,
    RemovalPolicy,
    aws_ecs as ecs,
    aws_iam as iam,
    aws_ecr_assets as ecr_assets,
    aws_scheduler as scheduler,
    aws_lambda as lambda,
    Duration,
    aws_lambda_event_sources as lambda_event_sources,
} from "aws-cdk-lib";
import { Construct } from 'constructs';

interface BackendStackProps extends StackProps {
    identity: ses.EmailIdentity;
    table: dynamodb.TableV2;
    index: string;
}

export default class BackendStack extends Stack {
    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'vpc', {
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            natGateways: 2,
            subnetConfiguration: [
                {
                    cidrMask: 18,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 28,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
            flowLogs: {
                'flowLog': {
                    trafficType: ec2.FlowLogTrafficType.ALL,
                    destination: ec2.FlowLogDestination.toCloudWatchLogs(
                        new logs.LogGroup(this, 'flowLogGroup', {
                            removalPolicy: RemovalPolicy.DESTROY,
                            retention: logs.RetentionDays.FIVE_DAYS
                        })
                    )
                }
            }
        });
        vpc.addInterfaceEndpoint('ecrDockerEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        });
        vpc.addGatewayEndpoint('dynamodbEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        });
        vpc.addInterfaceEndpoint('transcribeEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE_STREAMING,
        });
        // vpc.addInterfaceEndpoint('comprehendEndpoint', {
        //     service: ec2.InterfaceVpcEndpointAwsService.COMPREHEND,
        // });
        vpc.addInterfaceEndpoint('bedrockRuntimeEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
        });

        const securityGroup = new ec2.SecurityGroup(this, 'securityGroup', {
            vpc: vpc,
            allowAllOutbound: true,
        });

        const cluster = new ecs.Cluster(this, 'cluster', {
            vpc: vpc,
            containerInsights: true,
        });

        const taskRole = new iam.Role(this, 'taskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        props.table.grantReadWriteData(taskRole)
        taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['transcribe:*'],
            resources: ['*'],
        }));
        taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['comprehend:DetectPiiEntities'],
            resources: ['*'],
        }));
        taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [`arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`],
        }));
        props.identity.grantSendEmail(taskRole)

        const taskDefinition = new ecs.FargateTaskDefinition(this, 'taskDefinition', {
            cpu: 1024,
            memoryLimitMiB: 4096,
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
            },
            taskRole: taskRole,
        });

        const containerId = 'container'
        taskDefinition.addContainer(containerId, {
            image: ecs.ContainerImage.fromDockerImageAsset(
                new ecr_assets.DockerImageAsset(this, 'dockerImageAsset', {
                    directory: './src/backend/task',
                    platform: ecr_assets.Platform.LINUX_ARM64,
                })
            ),
            logging: new ecs.AwsLogDriver({
                streamPrefix: 'scribe',
                logRetention: logs.RetentionDays.FIVE_DAYS,
                mode: ecs.AwsLogDriverMode.NON_BLOCKING,
            }),
        });

        const meetingScheduleGroup = new scheduler.CfnScheduleGroup(this, 'meetingScheduleGroup', {});

        const eventbridgeSchedulerRole = new iam.Role(this, 'eventbridgeSchedulerRole', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('scheduler.amazonaws.com'),
                new iam.ServicePrincipal('events.amazonaws.com')
            )
        });
        eventbridgeSchedulerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ecs:TagResource'],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'ecs:CreateAction': ['RunTask']
                }
            }
        }));
        taskDefinition.grantRun(eventbridgeSchedulerRole)

        const lambdaSchedulerRole = new iam.Role(this, 'lambdaSchedulerRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        props.table.grantStreamRead(lambdaSchedulerRole)
        lambdaSchedulerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'scheduler:CreateSchedule',
                'scheduler:UpdateSchedule',
                'scheduler:DeleteSchedule',
                'scheduler:ListSchedules',
                'scheduler:DescribeSchedule'
            ],
            resources: [`arn:aws:scheduler:*:*:schedule/${meetingScheduleGroup.ref}/*`]
        }));
        lambdaSchedulerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "iam:PassRole"
            ],
            resources: [eventbridgeSchedulerRole.roleArn],
            conditions: {
                StringLike: {
                    "iam:PassedToService": "scheduler.amazonaws.com"
                }
            }
        }));
        taskDefinition.grantRun(lambdaSchedulerRole)

        const schedulerFunction = new lambda.Function(this, 'schedulerFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'scheduler.handler',
            role: lambdaSchedulerRole,
            timeout: Duration.minutes(2),
            code: lambda.Code.fromAsset('./src/backend/functions'),
            environment: {
                TASK_DEFINITION_ARN: taskDefinition.taskDefinitionArn,
                ECS_CLUSTER_ARN: cluster.clusterArn,
                SECURITY_GROUPS: JSON.stringify([securityGroup.securityGroupId]),
                SUBNETS: JSON.stringify(vpc.privateSubnets.map(subnet => subnet.subnetId)),
                CONTAINER_ID: containerId,
                TABLE_NAME: props.table.tableName,
                MEETING_INDEX: props.index,
                EMAIL_SOURCE: props.identity.emailIdentityName,
                // VOCABULARY_NAME: 'lingo',
                SCHEDULE_GROUP: meetingScheduleGroup.ref,
                SCHEDULER_ROLE_ARN: eventbridgeSchedulerRole.roleArn,
            },
            logRetention: logs.RetentionDays.FIVE_DAYS
        });

        schedulerFunction.addEventSource(
            new lambda_event_sources.DynamoEventSource(props.table, {
                startingPosition: lambda.StartingPosition.LATEST,
                retryAttempts: 3,
            })
        );

    }
}