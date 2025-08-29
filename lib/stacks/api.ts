import { AmplifyData, AmplifyDataDefinition, FieldLogLevel, RetentionDays } from "@aws-amplify/data-construct";
import {
    Stack,
    StackProps,
} from "aws-cdk-lib";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

interface ApiProps extends StackProps {
    userPool: UserPool;
    regionalWebAclArn: string;
}

export default class Api extends Stack {
    public readonly amplifiedGraphApi: AmplifyData;

    constructor(scope: Construct, id: string, props: ApiProps) {
        super(scope, id, props);

        const {userPool, regionalWebAclArn } = props;

        const amplifiedGraphApi = new AmplifyData(this, "amplifiedGraphApi", {
            definition: AmplifyDataDefinition.fromFiles("src/api/schema.graphql"),
            authorizationModes: {
                defaultAuthorizationMode: "AMAZON_COGNITO_USER_POOLS",
                userPoolConfig: {
                    userPool,
                },
                iamConfig: {
                    enableIamAuthorizationMode: true,
                },
            },
            logging: {
                fieldLogLevel: FieldLogLevel.ALL,
                retention: RetentionDays.ONE_MONTH,
                excludeVerboseContent: false,
            },

        });
        amplifiedGraphApi.resources.cfnResources.cfnGraphqlApi.xrayEnabled = true;
        Object.values(amplifiedGraphApi.resources.cfnResources.cfnTables).forEach((table) => {
            table.pointInTimeRecoverySpecification = {
                pointInTimeRecoveryEnabled: true,
            };
        });

        new CfnWebACLAssociation(this, "graphApiWebAclAssociation", {
            resourceArn: amplifiedGraphApi.resources.graphqlApi.arn,
            webAclArn: regionalWebAclArn,
        });

        this.amplifiedGraphApi = amplifiedGraphApi;
    }
}
