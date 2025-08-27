import { IAspect, RemovalPolicy } from "aws-cdk-lib";
import { CfnLogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { IConstruct } from "constructs";

export class LogsRetentionAspect implements IAspect {
    private readonly retentionDays: RetentionDays;

    constructor(retentionDays: RetentionDays) {
        this.retentionDays = retentionDays;
    }

    public visit(node: IConstruct): void {
        if (node instanceof CfnLogGroup) {
            node.applyRemovalPolicy(RemovalPolicy.DESTROY);
            node.retentionInDays = this.retentionDays;
        }
    }
}
