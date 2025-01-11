import {
    StackProps,
    aws_s3 as s3,
    aws_dynamodb as dynamodb,
    Stack,
    aws_appsync as appsync,
    RemovalPolicy,
    aws_wafv2 as waf,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_lambda as lambda,
    Duration,
    aws_iam as iam,
    aws_logs as logs,
    aws_cognito as cognito,
    aws_s3_deployment as s3_deployment,
    CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { execSync } from "child_process";
import { createManagedRules } from "./utils/rules";

interface FrontendStackProps extends StackProps {
    loggingBucket: s3.Bucket;
    email: string;
    table: dynamodb.TableV2;
}

export default class FrontendStack extends Stack {
    public readonly graphApi: appsync.GraphqlApi;

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        const websiteBucket = new s3.Bucket(this, "websiteBucket", {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsBucket: props.loggingBucket,
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
            logBucket: props.loggingBucket,
            logIncludesCookies: true,
            logFilePrefix: "distribution",
        });

        const postConfirmationLambda = new lambda.Function(
            this,
            "postConfirmationLambda",
            {
                runtime: lambda.Runtime.PYTHON_3_12,
                architecture: lambda.Architecture.ARM_64,
                timeout: Duration.minutes(2),
                handler: "confirm.handler",
                code: lambda.Code.fromAsset("./src/backend/functions"),
                initialPolicy: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["ses:GetAccount", "ses:VerifyEmailIdentity"],
                        resources: ["*"],
                    }),
                ],
                logRetention: logs.RetentionDays.FIVE_DAYS,
            }
        );

        const userPool = new cognito.UserPool(this, "userPool", {
            removalPolicy: RemovalPolicy.DESTROY,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                requireUppercase: true,
                tempPasswordValidity: Duration.days(1),
            },
            mfa: cognito.Mfa.OPTIONAL,
            mfaSecondFactor: {
                otp: true,
                sms: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
            lambdaTriggers: {
                postConfirmation: postConfirmationLambda,
            },
        });

        const userPoolClient = new cognito.UserPoolClient(
            this,
            "userPoolClient",
            {
                userPool: userPool,
                preventUserExistenceErrors: true,
                authFlows: {
                    userPassword: true,
                    userSrp: true,
                },
            }
        );

        new cognito.CfnUserPoolUser(this, "userPoolUser", {
            userPoolId: userPool.userPoolId,
            username: props.email,
        });

        this.graphApi = new appsync.GraphqlApi(this, "graphApi", {
            name: "graphApi",
            definition: appsync.Definition.fromFile("./src/schema.graphql"),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: userPool,
                    },
                },
                additionalAuthorizationModes: [
                    {
                        authorizationType: appsync.AuthorizationType.IAM,
                    },
                ],
            },
            logConfig: {
                fieldLogLevel: appsync.FieldLogLevel.ALL,
                retention: logs.RetentionDays.FIVE_DAYS,
            },
            xrayEnabled: true,
        });

        const sourceFunction = new lambda.Function(this, "sourceFunction", {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: "source.handler",
            timeout: Duration.minutes(2),
            code: lambda.Code.fromAsset("./src/backend/functions"),
            layers: [
                lambda.LayerVersion.fromLayerVersionArn(
                    this,
                    "PowerToolsLayer",
                    `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:78`
                ),
            ],
            environment: {
                TABLE_NAME: props.table.tableName,
            },
            logRetention: logs.RetentionDays.FIVE_DAYS,
        });
        props.table.grantReadWriteData(sourceFunction);

        const apiSource = this.graphApi.addLambdaDataSource(
            "apiSource",
            sourceFunction
        );
        apiSource.createResolver("createInviteResolver", {
            typeName: "Mutation",
            fieldName: "createInvite",
        });
        apiSource.createResolver("getInvitesResolver", {
            typeName: "Query",
            fieldName: "getInvites",
        });
        apiSource.createResolver("deleteInviteResolver", {
            typeName: "Mutation",
            fieldName: "deleteInvite",
        });

        const graphApiWebAcl = new waf.CfnWebACL(this, "graphApiWebAcl", {
            defaultAction: { allow: {} },
            scope: "REGIONAL",
            visibilityConfig: {
                metricName: "graphApiWebAcl",
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: createManagedRules("Api", [
                "AWSManagedRulesAmazonIpReputationList",
                "AWSManagedRulesCommonRuleSet",
                "AWSManagedRulesKnownBadInputsRuleSet",
            ]),
        });

        new waf.CfnWebACLAssociation(this, "graphApiWebAclAssociation", {
            resourceArn: this.graphApi.arn,
            webAclArn: graphApiWebAcl.attrArn,
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
            userPoolId: userPool.userPoolId,
            userPoolClientId: userPoolClient.userPoolClientId,
            graphApiUrl: this.graphApi.graphqlUrl,
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

        new CfnOutput(this, "userPoolId", {
            value: userPool.userPoolId,
        });

        new CfnOutput(this, "userPoolClientId", {
            value: userPoolClient.userPoolClientId,
        });
    }
}
