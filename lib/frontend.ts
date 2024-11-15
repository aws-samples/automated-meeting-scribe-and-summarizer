
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
    aws_s3_assets as s3_assets,
    aws_codebuild as codebuild,
    custom_resources,
    CfnOutput,
} from "aws-cdk-lib";
import { Construct } from 'constructs';

interface FrontendStackProps extends StackProps {
    email: string;
    table: dynamodb.TableV2;
}

export default class FrontendStack extends Stack {
    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        const website_bucket = new s3.Bucket(this, 'website_bucket', {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true
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
            ],
            webAclId: distribution_web_acl.attrArn
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
            preventUserExistenceErrors: true
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
            }
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

        const website_assets = new s3_assets.Asset(this, 'website_assets', {
            path: './src/frontend',
            exclude: ['build', 'node_modules']
        });

        const build_project = new codebuild.Project(this, 'build_project', {
            source: codebuild.Source.s3({
                bucket: website_assets.bucket,
                path: website_assets.s3ObjectKey,
            }),
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        commands: [
                            'npm install',
                        ]
                    },
                    pre_build: {
                        commands: [
                            `echo "REACT_APP_USER_POOL_ID=${user_pool.userPoolId}" >> .env`,
                            `echo "REACT_APP_USER_POOL_CLIENT_ID=${user_pool_client.userPoolClientId}" >> .env`,
                            `echo "REACT_APP_REST_API_ENDPOINT=${rest_api.url}" >> .env`,
                        ],
                    },
                    build: {
                        commands: [
                            'npm run build',
                        ],
                    },
                    post_build: {
                        commands: [
                            `aws s3 cp build/ s3://${website_bucket.bucketName} --recursive`,
                            `aws cloudfront create-invalidation --distribution-id ${distribution.distributionId} --paths "/*"`,
                        ],
                    },
                },
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                computeType: codebuild.ComputeType.SMALL,
            },
        });
        build_project.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                's3:PutObject',
                's3:ListBucket',
            ],
            resources: [
                website_bucket.bucketArn,
                `${website_bucket.bucketArn}/*`
            ],
        }));
        build_project.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'cloudfront:CreateInvalidation'
            ],
            resources: [
                `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
            ],
        }));

        new custom_resources.AwsCustomResource(this, 'StartBuild', {
            onCreate: {
                service: 'CodeBuild',
                action: 'startBuild',
                parameters: {
                    projectName: build_project.projectName,
                },
                physicalResourceId: custom_resources.PhysicalResourceId.of(Date.now().toString()),
            },
            onUpdate: {
                service: 'CodeBuild',
                action: 'startBuild',
                parameters: {
                    projectName: build_project.projectName,
                },
                physicalResourceId: custom_resources.PhysicalResourceId.of(Date.now().toString()),
            },
            policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [build_project.projectArn],
            }),
        });

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