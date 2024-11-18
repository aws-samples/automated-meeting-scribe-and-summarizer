
import {
    Stack,
    aws_s3 as s3,
    CfnParameter,
    aws_dynamodb as dynamodb,
    StackProps,
    aws_ses as ses,
    RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from 'constructs';

export default class DataStack extends Stack {
    public readonly logging_bucket: s3.Bucket;
    public readonly email: CfnParameter;
    public readonly table: dynamodb.TableV2;
    public readonly index: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.logging_bucket = new s3.Bucket(this, 'logging_bucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        })

        this.email = new CfnParameter(this, 'email', {
            type: 'String',
            description: 'This address is used to send meeting transcripts, summaries, action items, etc.',
            allowedPattern: '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$',
            default: this.node.tryGetContext('email')
        });

        new ses.EmailIdentity(this, 'identity', {
            identity: ses.Identity.email(this.email.valueAsString),
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

    }
}
