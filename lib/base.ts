
import {
    Stack,
    aws_s3 as s3,
    aws_ses as ses,
    aws_dynamodb as dynamodb,
    StackProps,
    RemovalPolicy,
    CfnParameter,
    Duration,
    aws_iam as iam,
    aws_scheduler as scheduler,
} from "aws-cdk-lib";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { Construct } from 'constructs';

export default class BaseStack extends Stack {
    public readonly loggingBucket: s3.Bucket;
    public readonly identity: ses.EmailIdentity;
    public readonly table: dynamodb.TableV2;
    public readonly index: string;
    public readonly knowledgeBucket: s3.Bucket;
    public readonly knowledgeBase: bedrock.KnowledgeBase;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.loggingBucket = new s3.Bucket(this, 'loggingBucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        })

        const email = new CfnParameter(this, 'email', {
            type: 'String',
            description: 'This address is used to send meeting transcripts, summaries, action items, etc.',
            allowedPattern: '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$',
            default: this.node.tryGetContext('email')
        });

        this.identity = new ses.EmailIdentity(this, 'identity', {
            identity: ses.Identity.email(email.valueAsString),
        });

        this.index = 'meeting_index';
        this.table = new dynamodb.TableV2(this, 'table', {
            removalPolicy: RemovalPolicy.DESTROY,
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
            globalSecondaryIndexes: [
                {
                    indexName: this.index,
                    partitionKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
                    projectionType: dynamodb.ProjectionType.ALL,
                },
            ],
            timeToLiveAttribute: 'meeting_expiration',
            dynamoStream: dynamodb.StreamViewType.NEW_IMAGE
        });

        this.knowledgeBucket = new s3.Bucket(this, 'knowledgeBucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsBucket: this.loggingBucket,
            serverAccessLogsPrefix: 'knowledge/',
            lifecycleRules: [{
                expiration: Duration.days(30)
            }]
        });

        this.knowledgeBase = new bedrock.KnowledgeBase(this, "knowledgeBase", {
            embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024
        });

        const knowledgeSource = new bedrock.S3DataSource(this, 'knowledgeSource', {
            bucket: this.knowledgeBucket,
            knowledgeBase: this.knowledgeBase,
            chunkingStrategy: bedrock.ChunkingStrategy.semantic({
                bufferSize: 1,
                maxTokens: 300,
                breakpointPercentileThreshold: 90,
            })
        })

        const ingestionRole = new iam.Role(this, 'ingestionRole', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('scheduler.amazonaws.com'),
                new iam.ServicePrincipal('events.amazonaws.com')
            ),
            inlinePolicies: {
                'ingestionPolicy': new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'bedrock:startIngestionJob',
                            ],
                            resources: [this.knowledgeBase.knowledgeBaseArn],
                        }),
                    ],
                }),
            },
        });

        const knowledgeScheduleGroup = new scheduler.CfnScheduleGroup(this, 'knowledgeScheduleGroup', {});

        new scheduler.CfnSchedule(this, 'knowledgeSchedule', {
            scheduleExpression: 'rate(1 hour)',
            flexibleTimeWindow: {
                mode: 'OFF'
            },
            groupName: knowledgeScheduleGroup.ref,
            target: {
                arn: 'arn:aws:scheduler:::aws-sdk:bedrockagent:startIngestionJob',
                roleArn: ingestionRole.roleArn,
                input: JSON.stringify({
                    KnowledgeBaseId: this.knowledgeBase.knowledgeBaseId,
                    DataSourceId: knowledgeSource.dataSourceId
                })
            }
        })

    }
}
