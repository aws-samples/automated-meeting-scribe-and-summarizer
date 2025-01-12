import {
    StackProps,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    Stack,
    aws_appsync as appsync,
    aws_wafv2 as waf,
    aws_lambda as lambda,
    Duration,
    aws_logs as logs,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { createManagedRules } from "./utils/rules";

interface ApiStackProps extends StackProps {
    userPool: cognito.UserPool;
    table: dynamodb.TableV2;
}

export default class ApiStack extends Stack {
    public readonly graphApi: appsync.GraphqlApi;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        this.graphApi = new appsync.GraphqlApi(this, "graphApi", {
            name: "scribeGraphApi",
            definition: appsync.Definition.fromFile("./src/api/schema.graphql"),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: props.userPool,
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
            handler: "resolvers.handler",
            timeout: Duration.minutes(2),
            code: lambda.Code.fromAsset("./src/api/function"),
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
    }
}
