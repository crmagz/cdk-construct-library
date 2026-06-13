# WAF Web ACL

`WafWebAcl` creates an AWS WAFv2 web ACL with AWS managed rules, CloudWatch
metrics, sampled requests, and environment-aware naming.

## Usage

Keep environment-specific web ACL props in a config file and pass the selected
props through the stack.

`bin/environments.ts`

```ts
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { type WafWebAclProps, WebAclScope } from '@cdk-construct/waf';

type EdgeEnvironment = EnvironmentConfig & {
  readonly waf: Omit<WafWebAclProps, 'env'>;
};

export const environments: EdgeEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    waf: {
      name: 'edge',
      scope: WebAclScope.REGIONAL,
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    waf: {
      name: 'edge',
      scope: WebAclScope.CLOUDFRONT,
    },
  },
];
```

`src/edge-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { WafWebAcl, type WafWebAclProps } from '@cdk-construct/waf';

type EdgeStackProps = StackProps &
  EnvironmentConfig & {
    readonly waf: Omit<WafWebAclProps, 'env'>;
  };

export class EdgeStack extends Stack {
  public constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new WafWebAcl(this, 'WebAcl', {
      env: props.env,
      ...props.waf,
    });
  }
}
```

## Defaults

The construct appends the environment name to `name` by default. A production
environment with `name: 'edge'` creates `edge-prod`; a development environment
creates `edge-dev`. Set `includeEnvironmentInName: false` when a global naming
scheme is managed elsewhere.

| Setting            | Default                                |
| ------------------ | -------------------------------------- |
| Scope              | `REGIONAL`                             |
| Default action     | Allow                                  |
| CloudWatch metrics | Enabled                                |
| Sampled requests   | Enabled                                |
| Tags               | `Environment` plus any supplied `tags` |

The default managed rule groups are:

| Priority | Managed rule group                      |
| -------- | --------------------------------------- |
| `0`      | `AWSManagedRulesCommonRuleSet`          |
| `10`     | `AWSManagedRulesKnownBadInputsRuleSet`  |
| `20`     | `AWSManagedRulesAmazonIpReputationList` |

## Managed Rule Tuning

Pass `managedRuleGroups` to replace the defaults or tune a group. Use
`ruleActionOverrides` to count a noisy managed rule while keeping the rest of the
group enforced.

```ts
new WafWebAcl(this, 'WebAcl', {
  env: props.env,
  name: 'edge',
  managedRuleGroups: [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 0,
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
```

## Custom Rules

Add custom WAF rules with `rules`. Choose priorities that do not conflict with
managed rule priorities.

```ts
new WafWebAcl(this, 'WebAcl', {
  env: props.env,
  name: 'edge',
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
```

## Escape Hatch

Use `webAclOverrides` for `CfnWebACLProps` that are not modeled directly by this
package.

```ts
new WafWebAcl(this, 'WebAcl', {
  env: props.env,
  name: 'edge',
  webAclOverrides: {
    tokenDomains: ['example.com'],
  },
});
```
