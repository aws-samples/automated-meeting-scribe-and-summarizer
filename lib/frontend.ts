
import {
    StackProps,
    aws_dynamodb as dynamodb,
    Stack,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_s3 as s3,
    RemovalPolicy,
    aws_lambda as lambda,
    Duration,
    aws_iam as iam,
    aws_cognito as cognito,
    aws_apigateway as apigateway,
    aws_logs as logs,
    aws_wafv2 as waf,
    aws_s3_deployment as s3_deployment,
    CfnOutput,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import { execSync } from 'child_process';

interface FrontendStackProps extends StackProps {
    loggingBucket: s3.Bucket;
    email: string;
    table: dynamodb.TableV2;
}

export default class FrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        const websiteBucket = new s3.Bucket(this, 'websiteBucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsBucket: props.loggingBucket,
            serverAccessLogsPrefix: 'website/'
        });

        function createManagedRule(
            prefix: string,
            name: string,
            priority: number
        ): waf.CfnWebACL.RuleProperty {
            const ruleName = `${prefix}-${name}`
            return {
                name: ruleName,
                priority: priority,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        vendorName: 'AWS',
                        name: name
                    }
                },
                visibilityConfig: {
                    metricName: ruleName,
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                }
            }
        }

        const distributionWebAcl = new waf.CfnWebACL(this, 'distributionWebAcl', {
            defaultAction: { allow: {} },
            scope: 'CLOUDFRONT',
            visibilityConfig: {
                metricName: 'distributionWebAcl',
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: [
                createManagedRule('Distribution', 'AWSManagedRulesAmazonIpReputationList', 0),
                createManagedRule('Distribution', 'AWSManagedRulesCommonRuleSet', 1),
                createManagedRule('Distribution', 'AWSManagedRulesKnownBadInputsRuleSet', 2)
            ]
        });

        const distribution = new cloudfront.Distribution(this, 'distribution', {
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responsePagePath: '/index.html',
                    responseHttpStatus: 200,
                },
                {
                    httpStatus: 403,
                    responsePagePath: '/index.html',
                    responseHttpStatus: 200,
                }
            ],
            webAclId: distributionWebAcl.attrArn,
            logBucket: props.loggingBucket,
            logIncludesCookies: true,
            logFilePrefix: 'distribution',
        });

        const postConfirmationLambda = new lambda.Function(this, 'postConfirmationLambda', {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            timeout: Duration.minutes(2),
            handler: 'confirm.handler',
            code: lambda.Code.fromAsset('./src/backend/functions'),
            initialPolicy: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['ses:GetAccount', 'ses:VerifyEmailIdentity'],
                    resources: ['*']
                })
            ]
        });

        const userPool = new cognito.UserPool(this, 'userPool', {
            removalPolicy: RemovalPolicy.DESTROY,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                requireUppercase: true,
                tempPasswordValidity: Duration.days(1)
            },
            mfa: cognito.Mfa.OPTIONAL,
            mfaSecondFactor: {
                otp: true,
                sms: false
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
            lambdaTriggers: {
                postConfirmation: postConfirmationLambda
            }
        });

        const userPoolClient = new cognito.UserPoolClient(this, 'userPoolClient', {
            userPool: userPool,
            preventUserExistenceErrors: true,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        new cognito.CfnUserPoolUser(this, 'userPoolUser', {
            userPoolId: userPool.userPoolId,
            username: props.email,
        })

        const allowed_origins = [
            `https://${distribution.distributionDomainName}`,
            // 'http://localhost:3000'
        ];

        const proxyFunction = new lambda.Function(this, 'proxyFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'proxy.handler',
            timeout: Duration.minutes(2),
            code: lambda.Code.fromAsset('./src/backend/functions'),
            layers: [
                lambda.LayerVersion.fromLayerVersionArn(
                    this,
                    'PowerToolsLayer',
                    `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:78`
                )
            ],
            environment: {
                ALLOWED_ORIGINS: JSON.stringify(allowed_origins),
                TABLE_NAME: props.table.tableName,
            },
            logRetention: logs.RetentionDays.FIVE_DAYS,
        });

        props.table.grantReadWriteData(proxyFunction)

        const restApi = new apigateway.LambdaRestApi(this, 'restApi', {
            handler: proxyFunction,
            proxy: true,
            defaultMethodOptions: {
                authorizationType: apigateway.AuthorizationType.COGNITO,
                authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'authorizer', {
                    cognitoUserPools: [userPool]
                }),
            },
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: allowed_origins,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
            },
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(
                    new logs.LogGroup(this, 'restApiLogGroup', {
                        removalPolicy: RemovalPolicy.DESTROY,
                        retention: logs.RetentionDays.FIVE_DAYS,
                    })
                ),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
            },
        });

        const restApiWebAcl = new waf.CfnWebACL(this, 'restApiWebAcl', {
            defaultAction: { allow: {} },
            scope: 'REGIONAL',
            visibilityConfig: {
                metricName: 'restApiWebAcl',
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: [
                createManagedRule('Api', 'AWSManagedRulesAmazonIpReputationList', 0),
                createManagedRule('Api', 'AWSManagedRulesCommonRuleSet', 1),
                createManagedRule('Api', 'AWSManagedRulesKnownBadInputsRuleSet', 2)
            ]
        });

        new waf.CfnWebACLAssociation(this, 'restApiWebAclAssociation', {
            resourceArn: restApi.deploymentStage.stageArn,
            webAclArn: restApiWebAcl.attrArn
        });

        const websitePath = './src/frontend'
        const websiteBundle = s3_deployment.Source.asset(websitePath, {
            bundling: {
                image: lambda.Runtime.NODEJS_20_X.bundlingImage,
                local: {
                    tryBundle(outputDirectory: string) {
                        execSync([
                            `cd ${websitePath}`,
                            'npm install',
                            'npm run build',
                            `cp -r dist/* ${outputDirectory}/`
                        ].join(' && '));
                        return true;
                    }
                },
            },
        });

        const config = {
            userPoolId: userPool.userPoolId,
            userPoolClientId: userPoolClient.userPoolClientId,
            restApiUrl: restApi.url
        };

        new s3_deployment.BucketDeployment(this, 'websiteDeployment', {
            sources: [
                websiteBundle,
                s3_deployment.Source.jsonData('config.json', config)
            ],
            destinationBucket: websiteBucket,
            distribution: distribution,
        })

        new CfnOutput(this, 'email', {
            value: props.email,
        });

        new CfnOutput(this, 'url', {
            value: distribution.distributionDomainName,
            description: 'CloudFront URL'
        });

        new CfnOutput(this, 'userPoolId', {
            value: userPool.userPoolId,
        });

        new CfnOutput(this, 'userPoolClientId', {
            value: userPoolClient.userPoolClientId,
        });

    }
}