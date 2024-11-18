
import {
    StackProps,
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
    email: string
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
                'flow_log': {
                    trafficType: ec2.FlowLogTrafficType.ALL,
                    destination: ec2.FlowLogDestination.toCloudWatchLogs(
                        new logs.LogGroup(this, 'flow_log_group', {
                            removalPolicy: RemovalPolicy.DESTROY,
                            retention: logs.RetentionDays.FIVE_DAYS
                        })
                    )
                }
            }
        });
        vpc.addInterfaceEndpoint('ecr_docker_endpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        });
        vpc.addGatewayEndpoint('dynamodb_endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        });
        vpc.addInterfaceEndpoint('transcribe_endpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE_STREAMING,
        });
        vpc.addInterfaceEndpoint('comprehend_endpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.COMPREHEND,
        });
        vpc.addInterfaceEndpoint('bedrock_runtime_endpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
        });

        const security_group = new ec2.SecurityGroup(this, 'security_group', {
            vpc: vpc,
            allowAllOutbound: true,
        });

        const cluster = new ecs.Cluster(this, 'cluster', {
            vpc: vpc,
            containerInsights: true,
        });

        const task_role = new iam.Role(this, 'task_role', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        props.table.grantReadWriteData(task_role)
        task_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['transcribe:*'],
            resources: ['*'],
        }));
        task_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['comprehend:DetectPiiEntities'],
            resources: ['*'],
        }));
        task_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [`arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`],
        }));
        task_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendRawEmail'],
            resources: ['*'],
        }));

        const task_definition = new ecs.FargateTaskDefinition(this, 'task_definition', {
            cpu: 1024,
            memoryLimitMiB: 4096,
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
            },
            taskRole: task_role,
        });

        const container_id = 'container'
        task_definition.addContainer(container_id, {
            image: ecs.ContainerImage.fromDockerImageAsset(
                new ecr_assets.DockerImageAsset(this, 'docker_image_asset', {
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

        const meeting_schedule_group = new scheduler.CfnScheduleGroup(this, 'meeting_schedule_group', {});

        const eventbridge_scheduler_role = new iam.Role(this, 'eventbridge_scheduler_role', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('scheduler.amazonaws.com'),
                new iam.ServicePrincipal('events.amazonaws.com')
            )
        });
        eventbridge_scheduler_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ecs:TagResource'],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'ecs:CreateAction': ['RunTask']
                }
            }
        }));
        task_definition.grantRun(eventbridge_scheduler_role)

        const lambda_scheduler_role = new iam.Role(this, 'lambda_scheduler_role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        props.table.grantStreamRead(lambda_scheduler_role)
        lambda_scheduler_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'scheduler:CreateSchedule',
                'scheduler:UpdateSchedule',
                'scheduler:DeleteSchedule',
                'scheduler:ListSchedules',
                'scheduler:DescribeSchedule'
            ],
            resources: [`arn:aws:scheduler:*:*:schedule/${meeting_schedule_group.ref}/*`]
        }));
        lambda_scheduler_role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "iam:PassRole"
            ],
            resources: [eventbridge_scheduler_role.roleArn],
            conditions: {
                StringLike: {
                    "iam:PassedToService": "scheduler.amazonaws.com"
                }
            }
        }));
        task_definition.grantRun(lambda_scheduler_role)

        const scheduler_function = new lambda.Function(this, 'scheduler_function', {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'scheduler.handler',
            role: lambda_scheduler_role,
            timeout: Duration.minutes(2),
            code: lambda.Code.fromAsset('./src/backend/functions'),
            environment: {
                TASK_DEFINITION_ARN: task_definition.taskDefinitionArn,
                ECS_CLUSTER_ARN: cluster.clusterArn,
                SECURITY_GROUPS: JSON.stringify([security_group.securityGroupId]),
                SUBNETS: JSON.stringify(vpc.privateSubnets.map(subnet => subnet.subnetId)),
                CONTAINER_ID: container_id,
                TABLE_NAME: props.table.tableName,
                MEETING_INDEX: props.index,
                EMAIL_SOURCE: props.email,
                // VOCABULARY_NAME: 'lingo',
                SCHEDULE_GROUP: meeting_schedule_group.ref,
                SCHEDULER_ROLE_ARN: eventbridge_scheduler_role.roleArn,
            },
            logRetention: logs.RetentionDays.FIVE_DAYS
        });

        scheduler_function.addEventSource(
            new lambda_event_sources.DynamoEventSource(props.table, {
                startingPosition: lambda.StartingPosition.LATEST,
                retryAttempts: 3,
            })
        );

    }
}