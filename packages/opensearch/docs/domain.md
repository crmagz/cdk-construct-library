# OpenSearch Domain

`OpenSearchDomain` creates an Amazon OpenSearch Service domain with secure defaults and environment-aware capacity.

## Environment Configuration

The construct requires `env` so production and non-production behavior is explicit at the call site.

```ts
import { EnvironmentName } from '@cdk-construct/core';
import type { OpenSearchDomainProps } from '@cdk-construct/opensearch';

export const environments: readonly OpenSearchDomainProps[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    domainName: 'catalog-search-dev',
    capacity: {
      dataNodes: 1,
    },
  },
  {
    env: {
      name: EnvironmentName.STAGING,
      account: '222222222222',
      region: 'us-east-1',
    },
    domainName: 'catalog-search-staging',
    capacity: {
      dataNodes: 2,
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    domainName: 'catalog-search-prod',
    capacity: {
      dataNodes: 6,
      masterNodes: 3,
    },
  },
];
```

## App Usage

Keep app code small by building environment-specific props elsewhere, then passing the selected object into the construct.

```ts
import { App, Stack } from 'aws-cdk-lib';
import { OpenSearchDomain } from '@cdk-construct/opensearch';
import { environments } from './environments.js';

const app = new App();

environments.forEach((props) => {
  const stack = new Stack(app, `search-${props.env.name}`, {
    env: {
      account: props.env.account,
      region: props.env.region,
    },
  });

  new OpenSearchDomain(stack, 'Search', props);
});
```

## Escape Hatches

Use top-level props for expected configuration. Use `domainOverrides` only when you need direct access to CDK `DomainProps`.

```ts
new OpenSearchDomain(stack, 'Search', {
  env,
  domainName: 'catalog-search-dev',
  domainOverrides: {
    enableAutoSoftwareUpdate: false,
  },
});
```

Escape hatches are applied last, so they can disable guardrails. Keep security tests around any override that changes encryption, TLS, logging, retention, or access policies.

## Security Fixture

`cdk-nag` AWS Solutions checks expect production OpenSearch domains to be placed in a VPC and to avoid anonymous access. Model those application-owned inputs outside the construct and pass them in through `vpc`, `securityGroups`, and `accessPolicies`.

Audit logs require `fineGrainedAccessControl`; the construct throws if `logging.auditLogEnabled` is set without it.
