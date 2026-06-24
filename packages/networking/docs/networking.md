# Networking Package

The networking package provides reusable AWS networking constructs for VPCs, subnet layouts, transit gateways, and VPC attachments.

## VPCs

`NetworkingVpc` creates a VPC with environment-aware defaults:

- production: three Availability Zones and two NAT gateways
- non-production: two Availability Zones and one NAT gateway
- subnet groups: public, private-with-egress, and data
- default CIDR: `10.0.0.0/16`
- default Availability Zones: the configured region's `a`, `b`, and `c` zones
- public subnet mask: `/26`
- private subnet mask: `/20`
- data subnet mask: `/24`
- data subnet routing: private isolated, with no NAT gateway or internet gateway route
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
network.dataSubnets;
```

Use `subnetConfiguration`, `maxAzs`, and `natGateways` for normal customization. Use `vpcOverrides` only when you need a direct CDK escape hatch.

Pass `cidrBlock`, `ipAddresses`, or `availabilityZones` when the consuming stack owns those placement choices.

## Transit Gateways

`TransitGateway` creates an `AWS::EC2::TransitGateway` with conservative attachment and routing defaults:

- shared attachment auto-accept disabled
- default route table association disabled
- default route table propagation disabled
- DNS support enabled
- VPN ECMP support enabled
- encryption support enabled
- security group referencing enabled

```ts
import { TransitGateway } from '@cdk-construct/networking';

new TransitGateway(stack, 'Transit', {
  transitGatewayName: 'core-network-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  vpcAttachments: [
    {
      id: 'ApplicationAttachment',
      attachmentName: 'application-network-prod',
      vpc: network.vpc,
    },
  ],
});
```

VPC attachments select private-with-egress subnets first, data subnets second, and public subnets only when neither private subnet group exists. Pass `subnets` or `subnetIds` to make attachment placement explicit.
