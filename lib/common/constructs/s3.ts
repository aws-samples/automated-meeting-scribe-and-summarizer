import { RemovalPolicy } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, BucketProps, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

type CommonBucketProps = Omit<
    BucketProps,
    "blockPublicAccess" | "enforceSSL" | "serverAccessLogsPrefix"
>;

export class CommonBucket extends Bucket {
    constructor(scope: Construct, id: string, props: CommonBucketProps) {
        super(scope, id, {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsPrefix: `${id}/`,
            objectOwnership: props.serverAccessLogsBucket
                ? undefined
                : ObjectOwnership.BUCKET_OWNER_PREFERRED,
            ...props,
        });
    }
}
