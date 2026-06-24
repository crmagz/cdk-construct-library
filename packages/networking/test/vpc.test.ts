import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';

import { NetworkingVpc, createNetworkingVpc } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

describe('NetworkingVpc', () => {
  it('synthesizes production VPC defaults with public, private, and isolated subnets', () => {
    const stack = new Stack(undefined, 'NetworkingVpcStack', {
      env: {
        account: prodEnv.account,
        region: prodEnv.region,
      },
    });

    const networking = new NetworkingVpc(stack, 'Network', {
      env: prodEnv,
      vpcName: 'shared-network-prod',
    });

    expect(networking.vpc.publicSubnets).toHaveLength(3);
    expect(networking.vpc.privateSubnets).toHaveLength(3);
    expect(networking.vpc.isolatedSubnets).toHaveLength(3);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Name',
          Value: 'shared-network-prod',
        }),
      ]),
    });
    template.resourceCountIs('AWS::EC2::NatGateway', 2);
    template.resourceCountIs('AWS::EC2::Subnet', 9);
    template.hasResourceProperties('AWS::EC2::FlowLog', {
      ResourceType: 'VPC',
      TrafficType: 'ALL',
      LogDestinationType: 'cloud-watch-logs',
    });
  });

  it('allows custom subnet layout and non-production capacity overrides', () => {
    const stack = new Stack();

    const { vpc } = createNetworkingVpc(stack, 'Network', {
      env: { name: EnvironmentName.DEV },
      vpcName: 'shared-network-dev',
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    expect(vpc.isolatedSubnets).toHaveLength(2);
    expect(vpc.privateSubnets).toHaveLength(0);
    expect(vpc.publicSubnets).toHaveLength(0);

    Template.fromStack(stack).resourceCountIs('AWS::EC2::NatGateway', 0);
  });
});
