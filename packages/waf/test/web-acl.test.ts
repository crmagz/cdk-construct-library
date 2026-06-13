import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { WafWebAcl, WebAclScope, createWafWebAcl } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const devEnv = {
  name: EnvironmentName.DEV,
  account: '123456789012',
  region: 'us-east-1',
};

const synthesizeWebAcl = (webAcl: WafWebAcl): Template => {
  return Template.fromStack(Stack.of(webAcl));
};

describe('WafWebAcl', () => {
  it('creates a regional web ACL with secure managed-rule defaults', () => {
    const stack = new Stack();
    const webAcl = new WafWebAcl(stack, 'EdgeAcl', {
      env: prodEnv,
      name: 'edge',
    });

    const template = synthesizeWebAcl(webAcl);
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Name: 'edge-prod',
      Scope: 'REGIONAL',
      DefaultAction: {
        Allow: {},
      },
      VisibilityConfig: {
        CloudWatchMetricsEnabled: true,
        MetricName: 'edge-prod',
        SampledRequestsEnabled: true,
      },
      Rules: [
        Match.objectLike({
          Name: 'AWSManagedRulesCommonRuleSet',
          Priority: 0,
          OverrideAction: {
            None: {},
          },
          Statement: {
            ManagedRuleGroupStatement: {
              Name: 'AWSManagedRulesCommonRuleSet',
              VendorName: 'AWS',
            },
          },
          VisibilityConfig: {
            CloudWatchMetricsEnabled: true,
            MetricName: 'edge-prod-AWSManagedRulesCommonRuleSet',
            SampledRequestsEnabled: true,
          },
        }),
        Match.objectLike({
          Name: 'AWSManagedRulesKnownBadInputsRuleSet',
          Priority: 10,
        }),
        Match.objectLike({
          Name: 'AWSManagedRulesAmazonIpReputationList',
          Priority: 20,
        }),
      ],
    });
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Tags: Match.arrayWith([
        {
          Key: 'Environment',
          Value: 'prod',
        },
      ]),
    });
  });

  it('supports CloudFront scope, explicit naming, tags, and managed rule tuning', () => {
    const stack = new Stack();
    const webAcl = new WafWebAcl(stack, 'EdgeAcl', {
      env: prodEnv,
      name: 'global-edge',
      includeEnvironmentInName: false,
      scope: WebAclScope.CLOUDFRONT,
      tags: {
        Application: 'edge',
      },
      managedRuleGroups: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 5,
          ruleActionOverrides: [
            {
              name: 'SizeRestrictions_BODY',
              actionToUse: {
                count: {},
              },
            },
          ],
        },
      ],
    });

    const template = synthesizeWebAcl(webAcl);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Name: 'global-edge',
      Scope: 'CLOUDFRONT',
      Rules: [
        Match.objectLike({
          Priority: 5,
          Statement: {
            ManagedRuleGroupStatement: {
              Name: 'AWSManagedRulesCommonRuleSet',
              RuleActionOverrides: [
                {
                  Name: 'SizeRestrictions_BODY',
                  ActionToUse: {
                    Count: {},
                  },
                },
              ],
              VendorName: 'AWS',
            },
          },
        }),
      ],
      Tags: Match.arrayWith([
        {
          Key: 'Application',
          Value: 'edge',
        },
      ]),
    });
  });

  it('appends custom rules and supports direct default action overrides', () => {
    const stack = new Stack();
    const webAcl = new WafWebAcl(stack, 'EdgeAcl', {
      env: devEnv,
      name: 'edge',
      defaultAction: {
        block: {},
      },
      metricName: 'Default_Action',
      rules: [
        {
          name: 'RateLimit',
          priority: 100,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: 2000,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'edge-rate-limit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    const template = synthesizeWebAcl(webAcl);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Name: 'edge-dev',
      DefaultAction: {
        Block: {},
      },
      VisibilityConfig: {
        MetricName: 'Default_Action-metric',
      },
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'RateLimit',
          Priority: 100,
          Action: {
            Block: {},
          },
          Statement: {
            RateBasedStatement: {
              AggregateKeyType: 'IP',
              Limit: 2000,
            },
          },
        }),
      ]),
    });
  });

  it('returns the created web ACL resource from the functional helper', () => {
    const stack = new Stack();
    const resources = createWafWebAcl(stack, 'EdgeAcl', {
      env: devEnv,
      name: 'edge',
    });

    expect(resources.webAcl.cfnResourceType).toBe('AWS::WAFv2::WebACL');
  });
});
