import type { CdkOverrides, EnvironmentAwareProps, TagMap } from '@cdk-construct/core';
import type { CfnWebACL, CfnWebACLProps } from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

export const WebAclScope = {
  REGIONAL: 'REGIONAL',
  CLOUDFRONT: 'CLOUDFRONT',
} as const;

export type WebAclScope = (typeof WebAclScope)[keyof typeof WebAclScope];

export type WafManagedRuleGroup = {
  readonly name: string;
  readonly vendorName?: string;
  readonly ruleName?: string;
  readonly priority?: number;
  readonly metricName?: string;
  readonly version?: string;
  readonly overrideAction?: CfnWebACL.OverrideActionProperty;
  readonly excludedRules?: readonly CfnWebACL.ExcludedRuleProperty[];
  readonly ruleActionOverrides?: readonly CfnWebACL.RuleActionOverrideProperty[];
  readonly managedRuleGroupConfigs?: readonly CfnWebACL.ManagedRuleGroupConfigProperty[];
  readonly scopeDownStatement?: CfnWebACL.StatementProperty;
  readonly visibilityConfig?: CfnWebACL.VisibilityConfigProperty;
};

export type WafWebAclProps = EnvironmentAwareProps & {
  readonly name: string;
  readonly includeEnvironmentInName?: boolean;
  readonly description?: string;
  readonly scope?: WebAclScope;
  readonly defaultAction?: CfnWebACL.DefaultActionProperty;
  readonly managedRuleGroups?: readonly WafManagedRuleGroup[];
  readonly rules?: readonly CfnWebACL.RuleProperty[];
  readonly metricName?: string;
  readonly cloudWatchMetricsEnabled?: boolean;
  readonly sampledRequestsEnabled?: boolean;
  readonly tags?: TagMap;
  readonly webAclOverrides?: CdkOverrides<CfnWebACLProps>;
};

export type WafWebAclResources = {
  readonly webAcl: CfnWebACL;
};

export type WafWebAclResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: WafWebAclProps;
};
