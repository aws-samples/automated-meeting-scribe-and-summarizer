import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import {
    AccountRecovery,
    CfnUserPoolUser,
    Mfa,
    UserPool,
    UserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { EmailIdentity, Identity } from "aws-cdk-lib/aws-ses";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { CommonNodejsFunction } from "../common/constructs/lambda";
import { createManagedRules } from "../common/utilities";

export default class Auth extends Stack {
    public readonly identity: EmailIdentity;
    public readonly userPool: UserPool;
    public readonly userPoolClient: UserPoolClient;
    public readonly regionalWebAclArn: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const identity = new EmailIdentity(this, "identity", {
            identity: Identity.email(process.env.EMAIL!),
        });

        const postConfirmationLambda = new CommonNodejsFunction(this, "postConfirmationLambda", {
            entry: "src/auth/confirm.ts",
            initialPolicy: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["ses:GetAccount", "ses:VerifyEmailIdentity"],
                    resources: ["*"],
                }),
            ],
            timeout: Duration.minutes(2),
        });

        const userPool = new UserPool(this, "userPool", {
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
            mfa: Mfa.OPTIONAL,
            mfaSecondFactor: {
                otp: true,
                sms: false,
            },
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
            lambdaTriggers: {
                postConfirmation: postConfirmationLambda,
            },
        });

        const userPoolClient = new UserPoolClient(this, "userPoolClient", {
            userPool,
            preventUserExistenceErrors: true,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        new CfnUserPoolUser(this, "userPoolUser", {
            userPoolId: userPool.userPoolId,
            username: identity.emailIdentityName,
        });

        const regionalWebAcl = new CfnWebACL(this, "regionalWebAcl", {
            defaultAction: { allow: {} },
            scope: "REGIONAL",
            visibilityConfig: {
                metricName: "regionalWebAcl",
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: [
                {
                    name: "ipRateLimitingRule",
                    priority: 0,
                    statement: {
                        rateBasedStatement: {
                            limit: 3000,
                            aggregateKeyType: "IP",
                        },
                    },
                    action: {
                        block: {},
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: "ipRateLimitingRule",
                    },
                },
                ...createManagedRules("regional", 1, [
                    {
                        name: "AWSManagedRulesCommonRuleSet",
                    },
                    {
                        name: "AWSManagedRulesKnownBadInputsRuleSet",
                    },
                    {
                        name: "AWSManagedRulesAmazonIpReputationList",
                    },
                ]),
            ],
        });
        const regionalWebAclArn = regionalWebAcl.attrArn;

        new CfnWebACLAssociation(this, "userPoolWebAclAssociation", {
            resourceArn: userPool.userPoolArn,
            webAclArn: regionalWebAclArn,
        });

        this.identity = identity;
        this.userPool = userPool;
        this.userPoolClient = userPoolClient;
        this.regionalWebAclArn = regionalWebAclArn;
    }
}
