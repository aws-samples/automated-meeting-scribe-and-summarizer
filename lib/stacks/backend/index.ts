import { AmplifyData } from "@aws-amplify/data-construct";
import {
    BedrockFoundationModel,
    CrossRegionInferenceProfile,
    CrossRegionInferenceProfileRegion,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import {
    FlowLogDestination,
    FlowLogTrafficType,
    InterfaceVpcEndpointAwsService,
    IpAddresses,
    SecurityGroup,
    SubnetType,
    Vpc,
} from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
    AwsLogDriver,
    AwsLogDriverMode,
    Cluster,
    ContainerImage,
    CpuArchitecture,
    FargateTaskDefinition,
    OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs";
import {
    CompositePrincipal,
    Effect,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import { EmailIdentity } from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";
import * as path from "path";
import { CommonNodejsFunction } from "../../common/constructs/lambda";

interface BackendProps extends StackProps {
    identity: EmailIdentity;
    amplifiedGraphApi: AmplifyData;
}

export default class Backend extends Stack {
    constructor(scope: Construct, id: string, props: BackendProps) {
        super(scope, id, props);

        const { identity, amplifiedGraphApi } = props;

        const table = amplifiedGraphApi.resources.tables.Invite;
        //amplifiedGraphApi.resources.cfnResources.cfnTables.Invite.timeToLiveSpecification =
        //     {
        //         enabled: true,
        //         attributeName: "expirationTime",
        //     };

        const vpc = new Vpc(this, "vpc", {
            ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            natGateways: 2,
            subnetConfiguration: [
                {
                    cidrMask: 18,
                    name: "Public",
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 28,
                    name: "Private",
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
            flowLogs: {
                flowLog: {
                    trafficType: FlowLogTrafficType.ALL,
                    destination: FlowLogDestination.toCloudWatchLogs(
                        new LogGroup(this, "flowLogGroup", {
                            removalPolicy: RemovalPolicy.DESTROY,
                            retention: RetentionDays.ONE_MONTH,
                        })
                    ),
                },
            },
        });
        vpc.addInterfaceEndpoint("ecrDockerInterfaceEndpoint", {
            service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
        });
        vpc.addInterfaceEndpoint("appSyncInterfaceEndpoint", {
            service: InterfaceVpcEndpointAwsService.APP_SYNC,
            privateDnsEnabled: false,
        });
        vpc.addInterfaceEndpoint("transcribeStreamingInterfaceEndpoint", {
            service: InterfaceVpcEndpointAwsService.TRANSCRIBE_STREAMING,
        });
        // vpc.addInterfaceEndpoint('comprehendInterfaceEndpoint', {
        //     service: InterfaceVpcEndpointAwsService.COMPREHEND,
        // });
        vpc.addInterfaceEndpoint("bedrockRuntimeInterfaceEndpoint", {
            service: InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
        });

        const securityGroup = new SecurityGroup(this, "securityGroup", {
            vpc: vpc,
            allowAllOutbound: true,
        });

        const cluster = new Cluster(this, "cluster", {
            vpc: vpc,
            containerInsights: true,
        });

        const profile = CrossRegionInferenceProfile.fromConfig({
            model: BedrockFoundationModel.ANTHROPIC_CLAUDE_3_7_SONNET_V1_0,
            geoRegion: CrossRegionInferenceProfileRegion.US,
        });

        const taskDefinition = new FargateTaskDefinition(this, "taskDefinition", {
            cpu: 2048,
            memoryLimitMiB: 4096,
            runtimePlatform: {
                cpuArchitecture: CpuArchitecture.ARM64,
                operatingSystemFamily: OperatingSystemFamily.LINUX,
            },
        });
        const taskRole = taskDefinition.taskRole;
        amplifiedGraphApi.resources.graphqlApi.grantMutation(taskRole);
        taskRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["transcribe:*", "comprehend:DetectPiiEntities"],
                resources: ["*"],
            })
        );
        profile.grantInvoke(taskRole);
        identity.grantSendEmail(taskRole);

        const containerId = "container";
        taskDefinition.addContainer(containerId, {
            image: ContainerImage.fromDockerImageAsset(
                new DockerImageAsset(this, "dockerImageAsset", {
                    directory: path.join(__dirname, "app"),
                    exclude: ["node_modules", "dist"],
                    platform: Platform.LINUX_ARM64,
                })
            ),
            logging: new AwsLogDriver({
                streamPrefix: "scribe",
                logRetention: RetentionDays.FIVE_DAYS,
                mode: AwsLogDriverMode.NON_BLOCKING,
            }),
        });

        const meetingScheduleGroup = new ScheduleGroup(this, "meetingScheduleGroup", {});

        const eventbridgeSchedulerRole = new Role(this, "eventbridgeSchedulerRole", {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal("scheduler.amazonaws.com"),
                new ServicePrincipal("events.amazonaws.com")
            ),
        });
        eventbridgeSchedulerRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["ecs:TagResource"],
                resources: ["*"],
                conditions: {
                    StringEquals: {
                        "ecs:CreateAction": ["RunTask"],
                    },
                },
            })
        );
        taskDefinition.grantRun(eventbridgeSchedulerRole);

        const schedulerFunction = new CommonNodejsFunction(this, "schedulerFunction", {
            timeout: Duration.minutes(2),
            entry: path.join(__dirname, "scheduler.ts"),
            environment: {
                TASK_DEFINITION_ARN: taskDefinition.taskDefinitionArn,
                CLUSTER_ARN: cluster.clusterArn,
                SECURITY_GROUPS: JSON.stringify([securityGroup.securityGroupId]),
                SUBNETS: JSON.stringify(vpc.privateSubnets.map((subnet) => subnet.subnetId)),
                CONTAINER_ID: containerId,
                GRAPH_API_URL: amplifiedGraphApi.graphqlUrl,
                MODEL_ID: profile.inferenceProfileId,
                EMAIL_SOURCE: identity.emailIdentityName,
                // VOCABULARY_NAME: 'lingo',
                SCHEDULE_GROUP: meetingScheduleGroup.scheduleGroupName,
                SCHEDULER_ROLE_ARN: eventbridgeSchedulerRole.roleArn,
            },
        });
        table.grantStreamRead(schedulerFunction);
        meetingScheduleGroup.grantWriteSchedules(schedulerFunction);
        meetingScheduleGroup.grantReadSchedules(schedulerFunction);
        meetingScheduleGroup.grantDeleteSchedules(schedulerFunction);
        eventbridgeSchedulerRole.grantPassRole(schedulerFunction.role!);
        taskDefinition.grantRun(schedulerFunction);

        schedulerFunction.addEventSource(
            new DynamoEventSource(table, {
                startingPosition: StartingPosition.LATEST,
                retryAttempts: 3,
            })
        );
    }
}
