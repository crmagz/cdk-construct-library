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
import { NetworkingVpc, TransitGateway } from '@cdk-construct/networking';

const stack = new Stack();

new NetworkingVpc(stack, 'Network', {
  vpcName: 'shared-network-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});

new TransitGateway(stack, 'Transit', {
  transitGatewayName: 'core-network-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});
```

## Defaults

- Creates public, private-with-egress, and data subnet groups by default.
- Implements data subnets as isolated private subnets with no internet route.
- Selects `a`, `b`, and `c` Availability Zones for the configured region by default.
- Uses a `/16` VPC CIDR by default, with smaller public subnets and larger private subnets.
- Enables VPC flow logs to CloudWatch Logs by default.
- Restricts the default security group.
- Uses three Availability Zones by default for every environment.
- Uses two NAT gateways in production and one NAT gateway in non-production by default.
- Creates transit gateways with shared attachment auto-accept and default route table association disabled.
- Enables DNS, ECMP, encryption, and security group referencing on transit gateways by default.
- Creates VPC attachments with DNS support enabled and IPv6/appliance mode disabled by default.
- Keeps CDK escape hatches explicit through typed override props.

## Documentation

- [Networking package](./docs/networking.md)
