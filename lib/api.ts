import {
    StackProps,
    aws_cognito as cognito,
    Stack,
    aws_appsync as appsync,
    aws_wafv2 as waf,
    aws_logs as logs,
} from "aws-cdk-lib";
import {
    AmplifyGraphqlApi,
    AmplifyGraphqlDefinition,
} from "@aws-amplify/graphql-api-construct";
import { Construct } from "constructs";
import { createManagedRules } from "./utils/rules";

interface ApiStackProps extends StackProps {
    userPool: cognito.UserPool;
}

export default class ApiStack extends Stack {
    public readonly graphApi: AmplifyGraphqlApi;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        this.graphApi = new AmplifyGraphqlApi(this, "graphApi", {
            definition: AmplifyGraphqlDefinition.fromFiles(
                "./src/api/schema.graphql"
            ),
            authorizationModes: {
                defaultAuthorizationMode: "AMAZON_COGNITO_USER_POOLS",
                userPoolConfig: {
                    userPool: props.userPool,
                },
                iamConfig: {
                    enableIamAuthorizationMode: true,
                },
            },
            logging: {
                fieldLogLevel: appsync.FieldLogLevel.ALL,
                retention: logs.RetentionDays.FIVE_DAYS,
            },
        });
        this.graphApi.resources.cfnResources.cfnGraphqlApi.xrayEnabled = true;

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
            resourceArn: this.graphApi.resources.graphqlApi.arn,
            webAclArn: graphApiWebAcl.attrArn,
        });
    }
}
