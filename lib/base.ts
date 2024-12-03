
import {
    Stack,
    aws_s3 as s3,
    aws_ses as ses,
    aws_dynamodb as dynamodb,
    StackProps,
    CfnParameter,
    RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from 'constructs';

export default class BaseStack extends Stack {
    public readonly loggingBucket: s3.Bucket;
    public readonly identity: ses.EmailIdentity;
    public readonly table: dynamodb.TableV2;
    public readonly index: string;

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

    }
}
