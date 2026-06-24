# Networking Package

The networking package provides reusable AWS networking constructs for VPCs, subnet layouts, transit gateways, and VPC attachments.

## VPCs

`NetworkingVpc` creates a VPC with environment-aware defaults:

- production: three Availability Zones and two NAT gateways
- non-production: two Availability Zones and one NAT gateway
- subnet groups: public, private-with-egress, and isolated
- VPC flow logs: enabled for all traffic
- default security group: restricted

```ts
import { EnvironmentName } from '@cdk-construct/core';
import { NetworkingVpc } from '@cdk-construct/networking';

const network = new NetworkingVpc(stack, 'Network', {
  vpcName: 'shared-network-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});

network.vpc.privateSubnets;
```

Use `subnetConfiguration`, `maxAzs`, and `natGateways` for normal customization. Use `vpcOverrides` only when you need a direct CDK escape hatch.
