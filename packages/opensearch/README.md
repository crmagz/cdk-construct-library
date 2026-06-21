# @cdk-construct/opensearch

OpenSearch domain constructs for AWS CDK with secure defaults, environment-aware capacity, and direct CDK override escape hatches.

## Install

```sh
npm install @cdk-construct/opensearch @cdk-construct/core
```

## Quick Start

```ts
import { Stack } from 'aws-cdk-lib';
import { EnvironmentName } from '@cdk-construct/core';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { AccountPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { OpenSearchDomain } from '@cdk-construct/opensearch';

const stack = new Stack();
const vpc = Vpc.fromLookup(stack, 'Vpc', {
  vpcName: 'shared-prod',
});
const securityGroup = SecurityGroup.fromSecurityGroupId(stack, 'DomainSecurityGroup', 'sg-1234');
const domainArn = Stack.of(stack).formatArn({
  service: 'es',
  resource: 'domain',
  resourceName: 'catalog-search-prod/*',
});

new OpenSearchDomain(stack, 'Search', {
  domainName: 'catalog-search-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  vpc,
  securityGroups: [securityGroup],
  accessPolicies: [
    new PolicyStatement({
      principals: [new AccountPrincipal('123456789012')],
      actions: ['es:ESHttp*'],
      resources: [domainArn],
      conditions: {
        IpAddress: {
          'aws:sourceIp': ['10.0.0.0/8'],
        },
      },
    }),
  ],
});
```

## Defaults

- Enforces HTTPS with the TLS 1.2 PFS policy.
- Enables encryption at rest and node-to-node encryption.
- Publishes application, slow search, and slow index logs to CloudWatch Logs.
- Uses GP3 EBS volumes sized for a practical starting point.
- Uses production multi-AZ standby with dedicated masters.
- Uses smaller non-production capacity and shorter log retention.
- Retains production domains and snapshots non-production domains by default.

## Production Security

Production domains require VPC placement. Build `OpenSearchDomainProps` with a VPC, security group, and scoped access policy from your application. The construct keeps those inputs explicit so network placement and caller identity stay owned by the consuming app.

## Documentation

- [Domain construct](./docs/domain.md)
