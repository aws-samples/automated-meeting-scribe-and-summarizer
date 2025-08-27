import { CloudfrontWebAcl } from "@aws/pdk/static-website";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
    AllowedMethods,
    Distribution,
    OriginRequestPolicy,
    SecurityPolicyProtocol,
    SSLMethod,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { execSync } from "child_process";
import { Construct } from "constructs";
import { CommonBucket } from "../common/constructs/s3";

interface FrontendProps extends StackProps {
    userPoolId: string;
    userPoolClientId: string;
    graphApiUrl: string;
}

export default class Frontend extends Stack {
    constructor(scope: Construct, id: string, props: FrontendProps) {
        super(scope, id, props);

        const loggingBucket = new CommonBucket(this, "loggingBucket", {});

        const websiteBucket = new CommonBucket(this, "websiteBucket", {
            serverAccessLogsBucket: loggingBucket,
        });

        const cloudfrontWebAcl = new CloudfrontWebAcl(this, "cloudfrontWebAcl", {
            managedRules: [
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesCommonRuleSet",
                },
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesAmazonIpReputationList",
                },
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesBotControlRuleSet",
                },
            ],
        });

        const distribution = new Distribution(this, "distribution", {
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
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
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            sslSupportMethod: SSLMethod.SNI,
            webAclId: cloudfrontWebAcl.webAclArn,
            logBucket: loggingBucket,
            logIncludesCookies: true,
            logFilePrefix: "distribution",
        });

        const websitePath = "./src/frontend";
        const websiteBundle = Source.asset(websitePath, {
            bundling: {
                image: Runtime.NODEJS_20_X.bundlingImage,
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
            userPoolId: new StringParameter(this, "userPoolIdParam", {
                stringValue: props.userPoolId,
            }).stringValue,
            userPoolClientId: new StringParameter(this, "userPoolClientIdParam", {
                stringValue: props.userPoolClientId,
            }).stringValue,
            graphApiUrl: new StringParameter(this, "graphApiUrlParam", {
                stringValue: props.graphApiUrl,
            }).stringValue,
        };

        new BucketDeployment(this, "websiteDeployment", {
            sources: [websiteBundle, Source.jsonData("config.json", config)],
            destinationBucket: websiteBucket,
            distribution: distribution,
        });

        new CfnOutput(this, "url", {
            value: distribution.distributionDomainName,
            description: "CloudFront URL",
        });
    }
}
