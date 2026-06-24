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
  it('synthesizes production VPC defaults with public, private, and data subnets', () => {
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
    expect(networking.dataSubnets).toHaveLength(3);
    expect(networking.dataSubnets).toEqual(networking.vpc.isolatedSubnets);

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
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1a',
      CidrBlock: '10.0.0.0/26',
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'aws-cdk:subnet-type',
          Value: 'Public',
        }),
      ]),
    });
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1a',
      CidrBlock: '10.0.16.0/20',
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'aws-cdk:subnet-type',
          Value: 'Private',
        }),
      ]),
    });
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1a',
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'aws-cdk:subnet-name',
          Value: 'data',
        }),
        Match.objectLike({
          Key: 'aws-cdk:subnet-type',
          Value: 'Isolated',
        }),
      ]),
    });
    template.hasResourceProperties('AWS::EC2::FlowLog', {
      ResourceType: 'VPC',
      TrafficType: 'ALL',
      LogDestinationType: 'cloud-watch-logs',
    });
  });

  it('allows custom subnet layout and non-production capacity overrides', () => {
    const stack = new Stack();

    const { dataSubnets, vpc } = createNetworkingVpc(stack, 'Network', {
      env: { name: EnvironmentName.DEV },
      vpcName: 'shared-network-dev',
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'data',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    expect(vpc.isolatedSubnets).toHaveLength(2);
    expect(dataSubnets).toHaveLength(2);
    expect(dataSubnets).toEqual(vpc.isolatedSubnets);
    expect(vpc.privateSubnets).toHaveLength(0);
    expect(vpc.publicSubnets).toHaveLength(0);

    Template.fromStack(stack).resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  it('honors maxAzs overrides when a region is configured', () => {
    const stack = new Stack();

    const { vpc } = createNetworkingVpc(stack, 'Network', {
      env: prodEnv,
      vpcName: 'max-az-network-prod',
      maxAzs: 2,
      natGateways: 0,
    });

    expect(vpc.availabilityZones).toEqual(['us-east-1a', 'us-east-1b']);

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::EC2::Subnet', 6);
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1a',
    });
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1b',
    });
  });

  it('allows callers to override CIDR blocks and availability zones', () => {
    const stack = new Stack();

    const { vpc } = createNetworkingVpc(stack, 'Network', {
      env: prodEnv,
      vpcName: 'custom-network-prod',
      cidrBlock: '10.40.0.0/16',
      availabilityZones: ['us-east-1b', 'us-east-1d'],
      natGateways: 0,
    });

    expect(vpc.availabilityZones).toEqual(['us-east-1b', 'us-east-1d']);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.40.0.0/16',
    });
    template.resourceCountIs('AWS::EC2::Subnet', 6);
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1b',
    });
    template.hasResourceProperties('AWS::EC2::Subnet', {
      AvailabilityZone: 'us-east-1d',
    });
  });
});
