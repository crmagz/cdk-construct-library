# @cdk-construct/networking

Networking constructs for AWS CDK with secure VPC defaults, subnet layout helpers, and transit gateway primitives.

## Install

```sh
npm install @cdk-construct/networking @cdk-construct/core
```

## Quick Start

```ts
import { Stack } from 'aws-cdk-lib';
import { EnvironmentName } from '@cdk-construct/core';
import { NetworkingVpc } from '@cdk-construct/networking';

const stack = new Stack();

new NetworkingVpc(stack, 'Network', {
  vpcName: 'shared-network-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});
```

## Defaults

- Creates public, private-with-egress, and isolated subnet groups by default.
- Enables VPC flow logs to CloudWatch Logs by default.
- Restricts the default security group.
- Uses production-oriented defaults with three Availability Zones and two NAT gateways.
- Uses smaller non-production defaults with two Availability Zones and one NAT gateway.
- Keeps CDK escape hatches explicit through typed override props.

## Documentation

- [Networking package](./docs/networking.md)
