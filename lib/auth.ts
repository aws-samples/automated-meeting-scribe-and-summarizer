import {
    Stack,
    aws_ses as ses,
    aws_cognito as cognito,
    StackProps,
    aws_lambda as lambda,
    Duration,
    aws_iam as iam,
    aws_logs as logs,
    RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export default class AuthStack extends Stack {
    public readonly identity: ses.EmailIdentity;
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.identity = new ses.EmailIdentity(this, "identity", {
            identity: ses.Identity.email(process.env.EMAIL!),
        });

        const postConfirmationLambda = new lambda.Function(
            this,
            "postConfirmationLambda",
            {
                runtime: lambda.Runtime.PYTHON_3_12,
                architecture: lambda.Architecture.ARM_64,
                timeout: Duration.minutes(2),
                handler: "confirm.handler",
                code: lambda.Code.fromAsset("./src/auth"),
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

        this.userPool = new cognito.UserPool(this, "userPool", {
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

        this.userPoolClient = new cognito.UserPoolClient(
            this,
            "userPoolClient",
            {
                userPool: this.userPool,
                preventUserExistenceErrors: true,
                authFlows: {
                    userPassword: true,
                    userSrp: true,
                },
            }
        );

        new cognito.CfnUserPoolUser(this, "userPoolUser", {
            userPoolId: this.userPool.userPoolId,
            username: this.identity.emailIdentityName,
        });
    }
}
