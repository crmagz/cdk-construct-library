import { applyTags, resolveEnvironmentConfig } from '@cdk-construct/core';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import type { CfnWebACLProps } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

import { WebAclScope } from './types.js';
import type {
  WafManagedRuleGroup,
  WafWebAclProps,
  WafWebAclResourceProps,
  WafWebAclResources,
} from './types.js';

const DEFAULT_RULE_PRIORITY_INCREMENT = 10;
const DEFAULT_MANAGED_RULE_VENDOR = 'AWS';
const DEFAULT_SCOPE = WebAclScope.REGIONAL;

export const defaultManagedRuleGroups = (): readonly WafManagedRuleGroup[] => {
  return [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 0,
    },
    {
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 10,
    },
    {
      name: 'AWSManagedRulesAmazonIpReputationList',
      priority: 20,
    },
  ];
};

const sanitizeMetricName = (value: string): string => {
  const metricName = value.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  const normalizedMetricName = metricName.length > 0 ? metricName.slice(0, 128) : 'web-acl';

  return normalizedMetricName === 'All' || normalizedMetricName === 'Default_Action'
    ? `${normalizedMetricName}-metric`
    : normalizedMetricName;
};

const resolveWebAclName = (props: WafWebAclProps): string => {
  const environment = resolveEnvironmentConfig(props);

  if (props.includeEnvironmentInName === false) {
    return props.name;
  }

  const environmentSuffix = `-${environment.name}`;

  return props.name.endsWith(environmentSuffix) ? props.name : `${props.name}${environmentSuffix}`;
};

const createVisibilityConfig = (
  metricName: string,
  props: WafWebAclProps,
): CfnWebACL.VisibilityConfigProperty => {
  return {
    cloudWatchMetricsEnabled: props.cloudWatchMetricsEnabled ?? true,
    metricName: sanitizeMetricName(metricName),
    sampledRequestsEnabled: props.sampledRequestsEnabled ?? true,
  };
};

export const createManagedRuleGroupRule = (
  ruleGroup: WafManagedRuleGroup,
  priority: number,
  defaultMetricName: string,
): CfnWebACL.RuleProperty => {
  const ruleName = ruleGroup.ruleName ?? ruleGroup.name;

  return {
    name: ruleName,
    priority,
    overrideAction: ruleGroup.overrideAction ?? { none: {} },
    statement: {
      managedRuleGroupStatement: {
        name: ruleGroup.name,
        vendorName: ruleGroup.vendorName ?? DEFAULT_MANAGED_RULE_VENDOR,
        version: ruleGroup.version,
        excludedRules: ruleGroup.excludedRules ? [...ruleGroup.excludedRules] : undefined,
        ruleActionOverrides: ruleGroup.ruleActionOverrides
          ? [...ruleGroup.ruleActionOverrides]
          : undefined,
        managedRuleGroupConfigs: ruleGroup.managedRuleGroupConfigs
          ? [...ruleGroup.managedRuleGroupConfigs]
          : undefined,
        scopeDownStatement: ruleGroup.scopeDownStatement,
      },
    },
    visibilityConfig: ruleGroup.visibilityConfig ?? {
      cloudWatchMetricsEnabled: true,
      metricName: sanitizeMetricName(`${defaultMetricName}-${ruleName}`),
      sampledRequestsEnabled: true,
    },
  };
};

export const createWebAclRules = (
  props: WafWebAclProps,
  metricName: string,
): CfnWebACL.RuleProperty[] => {
  const managedRules = (props.managedRuleGroups ?? defaultManagedRuleGroups()).map(
    (ruleGroup, index) => {
      return createManagedRuleGroupRule(
        ruleGroup,
        ruleGroup.priority ?? index * DEFAULT_RULE_PRIORITY_INCREMENT,
        metricName,
      );
    },
  );

  return [...managedRules, ...(props.rules ?? [])];
};

export const createWebAclResource = (resourceProps: WafWebAclResourceProps): CfnWebACL => {
  const { scope, id, props } = resourceProps;
  const environment = resolveEnvironmentConfig(props);
  const webAclName = resolveWebAclName(props);
  const metricName = props.metricName ?? webAclName;
  const webAclProps: CfnWebACLProps = {
    name: webAclName,
    description: props.description,
    scope: props.scope ?? DEFAULT_SCOPE,
    defaultAction: props.defaultAction ?? { allow: {} },
    rules: createWebAclRules(props, metricName),
    visibilityConfig: createVisibilityConfig(metricName, props),
    ...props.webAclOverrides,
  };
  const webAcl = new CfnWebACL(scope, id, webAclProps);

  applyTags(webAcl, {
    Environment: environment.name,
    ...props.tags,
  });

  return webAcl;
};

export class WafWebAcl extends Construct {
  public readonly webAcl: CfnWebACL;

  public constructor(scope: Construct, id: string, props: WafWebAclProps) {
    super(scope, id);

    this.webAcl = createWebAclResource({
      scope: this,
      id: 'Resource',
      props,
    });
  }
}

export const createWafWebAcl = (
  scope: Construct,
  id: string,
  props: WafWebAclProps,
): WafWebAclResources => {
  const wafWebAcl = new WafWebAcl(scope, id, props);

  return {
    webAcl: wafWebAcl.webAcl,
  };
};
