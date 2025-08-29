import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";

export function createManagedRules(
    prefix: string,
    startingPriority: number,
    rules: {
        name: string;
        overrideAction?: CfnWebACL.OverrideActionProperty;
        ruleActionOverrides?: CfnWebACL.RuleActionOverrideProperty[];
    }[]
): CfnWebACL.RuleProperty[] {
    return rules.map((rule, index) => {
        const ruleName = `${prefix}-${rule.name}`;
        return {
            name: ruleName,
            priority: startingPriority + index,
            overrideAction: rule.overrideAction || {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: rule.name,
                    ruleActionOverrides: rule.ruleActionOverrides,
                },
            },
            visibilityConfig: {
                metricName: ruleName,
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
        };
    });
}
