import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import {
  FlowLogDestination,
  FlowLogTrafficType,
  IpAddresses,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import type { SubnetConfiguration, VpcProps } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import type {
  CreateNetworkingVpcResourceProps,
  NetworkingVpcDefaults,
  NetworkingVpcProps,
  NetworkingVpcResources,
} from './types.js';

const DEFAULT_CIDR = '10.0.0.0/16';
const DEFAULT_PUBLIC_CIDR_MASK = 24;
const DEFAULT_PRIVATE_CIDR_MASK = 24;
const DEFAULT_ISOLATED_CIDR_MASK = 24;
const DEFAULT_PROD_MAX_AZS = 3;
const DEFAULT_NON_PROD_MAX_AZS = 2;
const DEFAULT_PROD_NAT_GATEWAYS = 2;
const DEFAULT_NON_PROD_NAT_GATEWAYS = 1;

const defaultSubnetConfiguration = (): SubnetConfiguration[] => [
  {
    cidrMask: DEFAULT_PUBLIC_CIDR_MASK,
    name: 'public',
    subnetType: SubnetType.PUBLIC,
  },
  {
    cidrMask: DEFAULT_PRIVATE_CIDR_MASK,
    name: 'private',
    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
  },
  {
    cidrMask: DEFAULT_ISOLATED_CIDR_MASK,
    name: 'isolated',
    subnetType: SubnetType.PRIVATE_ISOLATED,
  },
];

const defaultsForEnvironment = (props: NetworkingVpcProps): NetworkingVpcDefaults => {
  const environment = resolveEnvironmentConfig(props);

  return {
    maxAzs: isProductionEnvironment(environment) ? DEFAULT_PROD_MAX_AZS : DEFAULT_NON_PROD_MAX_AZS,
    natGateways: isProductionEnvironment(environment)
      ? DEFAULT_PROD_NAT_GATEWAYS
      : DEFAULT_NON_PROD_NAT_GATEWAYS,
    subnetConfiguration: defaultSubnetConfiguration(),
  };
};

const createVpcProps = (props: NetworkingVpcProps, defaults: NetworkingVpcDefaults): VpcProps => {
  return {
    vpcName: props.vpcName,
    ipAddresses: props.ipAddresses ?? IpAddresses.cidr(DEFAULT_CIDR),
    maxAzs: props.maxAzs ?? defaults.maxAzs,
    natGateways: props.natGateways ?? defaults.natGateways,
    subnetConfiguration: props.subnetConfiguration
      ? [...props.subnetConfiguration]
      : [...defaults.subnetConfiguration],
    enableDnsHostnames: true,
    enableDnsSupport: true,
    restrictDefaultSecurityGroup: true,
    flowLogs: props.flowLogs ?? {
      all: {
        destination: FlowLogDestination.toCloudWatchLogs(),
        trafficType: FlowLogTrafficType.ALL,
      },
    },
    ...props.vpcOverrides,
  };
};

export class NetworkingVpc extends Construct {
  public readonly vpc: Vpc;

  public constructor(scope: Construct, id: string, props: NetworkingVpcProps) {
    super(scope, id);

    const resources = createNetworkingVpcResource({
      scope: this,
      id: 'Resource',
      props,
    });

    this.vpc = resources.vpc;
  }
}

export const createNetworkingVpcResource = (
  resourceProps: CreateNetworkingVpcResourceProps,
): NetworkingVpcResources => {
  const { scope, id, props } = resourceProps;
  const defaults = defaultsForEnvironment(props);
  const vpc = new Vpc(scope, `${id}Vpc`, createVpcProps(props, defaults));

  return { vpc };
};

export const createNetworkingVpc = (
  scope: Construct,
  id: string,
  props: NetworkingVpcProps,
): NetworkingVpcResources => {
  const networkingVpc = new NetworkingVpc(scope, id, props);

  return {
    vpc: networkingVpc.vpc,
  };
};
