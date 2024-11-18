
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
    logging_bucket: s3.Bucket;
    email: string;
    table: dynamodb.TableV2;
}

export default class FrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        const website_bucket = new s3.Bucket(this, 'website_bucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            serverAccessLogsBucket: props.logging_bucket,
            serverAccessLogsPrefix: 'website'
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

        const distribution_web_acl = new waf.CfnWebACL(this, 'distribution_web_acl', {
            defaultAction: { allow: {} },
            scope: 'CLOUDFRONT',
            visibilityConfig: {
                metricName: 'distribution_web_acl',
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
                origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(website_bucket),
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
            webAclId: distribution_web_acl.attrArn,
            logBucket: props.logging_bucket,
            logIncludesCookies: true,
            logFilePrefix: 'distribution',
        });

        const post_confirmation_lambda = new lambda.Function(this, 'post_confirmation_lambda', {
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

        const user_pool = new cognito.UserPool(this, 'user_pool', {
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
                postConfirmation: post_confirmation_lambda
            }
        });

        const user_pool_client = new cognito.UserPoolClient(this, 'user_pool_client', {
            userPool: user_pool,
            preventUserExistenceErrors: true,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        new cognito.CfnUserPoolUser(this, 'user_pool_user', {
            userPoolId: user_pool.userPoolId,
            username: props.email,
        })

        const allowed_origins = [
            `https://${distribution.distributionDomainName}`,
            'http://localhost:3000'
        ];

        const proxy_function = new lambda.Function(this, 'proxy_function', {
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

        props.table.grantReadWriteData(proxy_function)

        const rest_api = new apigateway.LambdaRestApi(this, 'rest_api', {
            handler: proxy_function,
            proxy: true,
            defaultMethodOptions: {
                authorizationType: apigateway.AuthorizationType.COGNITO,
                authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'authorizer', {
                    cognitoUserPools: [user_pool]
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
                    new logs.LogGroup(this, 'rest_api_log_group', {
                        removalPolicy: RemovalPolicy.DESTROY,
                        retention: logs.RetentionDays.FIVE_DAYS,
                    })
                ),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
            },
        });

        const rest_api_web_acl = new waf.CfnWebACL(this, 'rest_api_web_acl', {
            defaultAction: { allow: {} },
            scope: 'REGIONAL',
            visibilityConfig: {
                metricName: 'rest_api_web_acl',
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: [
                createManagedRule('Api', 'AWSManagedRulesAmazonIpReputationList', 0),
                createManagedRule('Api', 'AWSManagedRulesCommonRuleSet', 1),
                createManagedRule('Api', 'AWSManagedRulesKnownBadInputsRuleSet', 2)
            ]
        });

        new waf.CfnWebACLAssociation(this, 'rest_api_web_acl_association', {
            resourceArn: rest_api.deploymentStage.stageArn,
            webAclArn: rest_api_web_acl.attrArn
        });

        const website_path = './src/frontend'
        const website_bundle = s3_deployment.Source.asset(website_path, {
            bundling: {
                image: lambda.Runtime.NODEJS_20_X.bundlingImage,
                local: {
                    tryBundle(output_directory: string) {
                        execSync([
                            `cd ${website_path}`,
                            'npm install',
                            'npm run build',
                            `cp -r dist/* ${output_directory}/`
                        ].join(' && '));
                        return true;
                    }
                },
            },
        });

        const config = {
            userPoolId: user_pool.userPoolId,
            userPoolClientId: user_pool_client.userPoolClientId,
            restApiUrl: rest_api.url
        };

        new s3_deployment.BucketDeployment(this, 'website_deployment', {
            sources: [
                website_bundle,
                s3_deployment.Source.jsonData('config.json', config)
            ],
            destinationBucket: website_bucket,
            distribution: distribution,
        })

        new CfnOutput(this, 'email', {
            value: props.email,
        });

        new CfnOutput(this, 'url', {
            value: distribution.distributionDomainName,
            description: 'CloudFront URL'
        });

        new CfnOutput(this, 'user_pool_id', {
            value: user_pool.userPoolId,
        });

        new CfnOutput(this, 'user_pool_client_id', {
            value: user_pool_client.userPoolClientId,
        });

    }
}