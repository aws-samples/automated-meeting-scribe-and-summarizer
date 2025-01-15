import {
    StackProps,
    aws_s3 as s3,
    Stack,
    RemovalPolicy,
    aws_wafv2 as waf,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_lambda as lambda,
    aws_s3_deployment as s3_deployment,
    aws_ssm as ssm,
    CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { execSync } from "child_process";
import { createManagedRules } from "./utils/rules";

interface FrontendStackProps extends StackProps {
    userPoolId: string;
    userPoolClientId: string;
    graphApiUrl: string;
}

export default class FrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        const loggingBucket = new s3.Bucket(this, "loggingBucket", {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        });

        const websiteBucket = new s3.Bucket(this, "websiteBucket", {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsBucket: loggingBucket,
            serverAccessLogsPrefix: "website/",
        });

        const distributionWebAcl = new waf.CfnWebACL(
            this,
            "distributionWebAcl",
            {
                defaultAction: { allow: {} },
                scope: "CLOUDFRONT",
                visibilityConfig: {
                    metricName: "distributionWebAcl",
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                },
                rules: createManagedRules("Distribution", [
                    "AWSManagedRulesAmazonIpReputationList",
                    "AWSManagedRulesCommonRuleSet",
                    "AWSManagedRulesKnownBadInputsRuleSet",
                ]),
            }
        );

        const distribution = new cloudfront.Distribution(this, "distribution", {
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(
                    websiteBucket
                ),
                viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responsePagePath: "/index.html",
                    responseHttpStatus: 200,
                },
                {
                    httpStatus: 403,
                    responsePagePath: "/index.html",
                    responseHttpStatus: 200,
                },
            ],
            webAclId: distributionWebAcl.attrArn,
            logBucket: loggingBucket,
            logIncludesCookies: true,
            logFilePrefix: "distribution",
        });

        const websitePath = "./src/frontend";
        const websiteBundle = s3_deployment.Source.asset(websitePath, {
            bundling: {
                image: lambda.Runtime.NODEJS_20_X.bundlingImage,
                local: {
                    tryBundle(outputDirectory: string) {
                        execSync(
                            [
                                `cd ${websitePath}`,
                                "npm install",
                                "npm run build",
                                `cp -r dist/* ${outputDirectory}/`,
                            ].join(" && ")
                        );
                        return true;
                    },
                },
            },
        });

        const config = {
            userPoolId: new ssm.StringParameter(this, "userPoolIdParam", {
                stringValue: props.userPoolId,
            }).stringValue,
            userPoolClientId: new ssm.StringParameter(
                this,
                "userPoolClientIdParam",
                {
                    stringValue: props.userPoolClientId,
                }
            ).stringValue,
            graphApiUrl: new ssm.StringParameter(this, "graphApiUrlParam", {
                stringValue: props.graphApiUrl,
            }).stringValue,
        };

        new s3_deployment.BucketDeployment(this, "websiteDeployment", {
            sources: [
                websiteBundle,
                s3_deployment.Source.jsonData("config.json", config),
            ],
            destinationBucket: websiteBucket,
            distribution: distribution,
        });

        new CfnOutput(this, "url", {
            value: distribution.distributionDomainName,
            description: "CloudFront URL",
        });
    }
}
