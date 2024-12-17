
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
    aws_appsync as appsync,
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

        const api = new appsync.GraphqlApi(this, 'api', {
            name: 'graphApi',
            definition: appsync.Definition.fromFile('./src/api/schema.graphql'),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: userPool,
                    }
                }
            },
            logConfig: {
                retention: logs.RetentionDays.FIVE_DAYS,
            },
            xrayEnabled: true,
        });

        const source = api.addDynamoDbDataSource('source', props.table);
        source.createResolver('getInvitesResolver', {
            typeName: 'Query',
            fieldName: 'getInvites',
            runtime: appsync.FunctionRuntime.JS_1_0_0,
            code: appsync.Code.fromAsset('./src/api/resolvers/getInvites.js')
        });
        source.createResolver('createInviteResolver', {
            typeName: 'Mutation',
            fieldName: 'createInvite',
            runtime: appsync.FunctionRuntime.JS_1_0_0,
            code: appsync.Code.fromAsset('./src/api/resolvers/createInvite.js')
        });
        source.createResolver('deleteInviteResolver', {
            typeName: 'Mutation',
            fieldName: 'deleteInvite',
            runtime: appsync.FunctionRuntime.JS_1_0_0,
            code: appsync.Code.fromAsset('./src/api/resolvers/deleteInvite.js')
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
            graphApiUrl: api.graphqlUrl,
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