
import { aws_wafv2 as waf } from "aws-cdk-lib";

export function createManagedRules(
    prefix: string,
    names: string[]
): waf.CfnWebACL.RuleProperty[] {
    return names.map((name, index) => {
        const ruleName = `${prefix}-${name}`
        return {
            name: ruleName,
            priority: index,
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
    })
}
