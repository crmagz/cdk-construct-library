import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import { WafWebAcl } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createSecurityApp = (): App => {
  const app = new App();
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return app;
};

describe('WafWebAcl security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'WafWebAclSecurityStack');

    new WafWebAcl(stack, 'EdgeAcl', {
      env: prodEnv,
      name: 'security-edge',
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('synthesizes managed rules and visibility guardrails by default', () => {
    const stack = new Stack();

    new WafWebAcl(stack, 'EdgeAcl', {
      env: prodEnv,
      name: 'security-edge',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      VisibilityConfig: {
        CloudWatchMetricsEnabled: true,
        SampledRequestsEnabled: true,
      },
      Rules: Match.arrayWith([
        Match.objectLike({
          Statement: {
            ManagedRuleGroupStatement: {
              Name: 'AWSManagedRulesCommonRuleSet',
              VendorName: 'AWS',
            },
          },
        }),
        Match.objectLike({
          Statement: {
            ManagedRuleGroupStatement: {
              Name: 'AWSManagedRulesKnownBadInputsRuleSet',
              VendorName: 'AWS',
            },
          },
        }),
        Match.objectLike({
          Statement: {
            ManagedRuleGroupStatement: {
              Name: 'AWSManagedRulesAmazonIpReputationList',
              VendorName: 'AWS',
            },
          },
        }),
      ]),
    });
  });

  it('has a negative canary for escape-hatch overrides that disable guardrails', () => {
    const stack = new Stack();

    new WafWebAcl(stack, 'EdgeAcl', {
      env: prodEnv,
      name: 'insecure-edge',
      webAclOverrides: {
        rules: [],
        visibilityConfig: {
          cloudWatchMetricsEnabled: false,
          metricName: 'insecure-edge',
          sampledRequestsEnabled: false,
        },
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      VisibilityConfig: {
        CloudWatchMetricsEnabled: false,
        SampledRequestsEnabled: false,
      },
      Rules: [],
    });
  });
});
