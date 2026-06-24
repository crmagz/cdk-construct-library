import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import {
  FlowLogDestination,
  FlowLogTrafficType,
  IpAddresses,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import type { ISubnet, SubnetConfiguration, VpcProps } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import type {
  CreateNetworkingVpcResourceProps,
  NetworkingVpcDefaults,
  NetworkingVpcProps,
  NetworkingVpcResources,
} from './types.js';

const DEFAULT_CIDR = '10.0.0.0/16';
const DEFAULT_PUBLIC_CIDR_MASK = 26;
const DEFAULT_PRIVATE_CIDR_MASK = 20;
const DEFAULT_DATA_CIDR_MASK = 24;
const DEFAULT_MAX_AZS = 3;
const DEFAULT_PROD_NAT_GATEWAYS = 2;
const DEFAULT_NON_PROD_NAT_GATEWAYS = 1;
const DEFAULT_AVAILABILITY_ZONE_SUFFIXES = ['a', 'b', 'c'] as const;

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
    cidrMask: DEFAULT_DATA_CIDR_MASK,
    name: 'data',
    subnetType: SubnetType.PRIVATE_ISOLATED,
  },
];

const defaultsForEnvironment = (props: NetworkingVpcProps): NetworkingVpcDefaults => {
  const environment = resolveEnvironmentConfig(props);

  return {
    availabilityZones: environment.region
      ? DEFAULT_AVAILABILITY_ZONE_SUFFIXES.map((suffix) => `${environment.region}${suffix}`)
      : undefined,
    maxAzs: DEFAULT_MAX_AZS,
    natGateways: isProductionEnvironment(environment)
      ? DEFAULT_PROD_NAT_GATEWAYS
      : DEFAULT_NON_PROD_NAT_GATEWAYS,
    subnetConfiguration: defaultSubnetConfiguration(),
  };
};

const validateNetworkingVpcProps = (props: NetworkingVpcProps): void => {
  if (props.vpcName.trim().length === 0) {
    throw new Error('NetworkingVpc vpcName must not be empty.');
  }

  if (props.cidrBlock !== undefined && props.cidrBlock.trim().length === 0) {
    throw new Error('NetworkingVpc cidrBlock must not be empty.');
  }

  if (props.cidrBlock !== undefined && props.ipAddresses !== undefined) {
    throw new Error('NetworkingVpc cannot specify both cidrBlock and ipAddresses.');
  }

  if (props.availabilityZones !== undefined && props.maxAzs !== undefined) {
    throw new Error('NetworkingVpc cannot specify both availabilityZones and maxAzs.');
  }

  if (props.maxAzs !== undefined && (!Number.isInteger(props.maxAzs) || props.maxAzs < 1)) {
    throw new Error('NetworkingVpc maxAzs must be a positive integer.');
  }

  if (props.availabilityZones !== undefined && props.availabilityZones.length === 0) {
    throw new Error('NetworkingVpc availabilityZones must include at least one zone.');
  }

  const availabilityZones = props.availabilityZones ?? [];
  const uniqueAvailabilityZones = new Set<string>();

  availabilityZones.forEach((availabilityZone) => {
    if (availabilityZone.trim().length === 0) {
      throw new Error('NetworkingVpc availabilityZones must not contain empty values.');
    }

    if (uniqueAvailabilityZones.has(availabilityZone)) {
      throw new Error(`NetworkingVpc availability zone ${availabilityZone} must be unique.`);
    }

    uniqueAvailabilityZones.add(availabilityZone);
  });
};

const resolveAvailabilityZones = (
  props: NetworkingVpcProps,
  defaults: NetworkingVpcDefaults,
): readonly string[] | undefined => {
  if (props.availabilityZones) {
    return [...props.availabilityZones];
  }

  const maxAzs = props.maxAzs ?? defaults.maxAzs;

  if (!defaults.availabilityZones || maxAzs > defaults.availabilityZones.length) {
    return undefined;
  }

  return defaults.availabilityZones.slice(0, maxAzs);
};

const createVpcProps = (props: NetworkingVpcProps, defaults: NetworkingVpcDefaults): VpcProps => {
  const availabilityZones = resolveAvailabilityZones(props, defaults);
  const maxAzs = props.maxAzs ?? defaults.maxAzs;

  return {
    vpcName: props.vpcName,
    ipAddresses: props.ipAddresses ?? IpAddresses.cidr(props.cidrBlock ?? DEFAULT_CIDR),
    maxAzs: availabilityZones ? undefined : maxAzs,
    availabilityZones: availabilityZones ? [...availabilityZones] : undefined,
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
  public readonly dataSubnets: readonly ISubnet[];

  public constructor(scope: Construct, id: string, props: NetworkingVpcProps) {
    super(scope, id);

    const resources = createNetworkingVpcResource({
      scope: this,
      id: 'Resource',
      props,
    });

    this.vpc = resources.vpc;
    this.dataSubnets = resources.dataSubnets;
  }
}

export const createNetworkingVpcResource = (
  resourceProps: CreateNetworkingVpcResourceProps,
): NetworkingVpcResources => {
  const { scope, id, props } = resourceProps;
  validateNetworkingVpcProps(props);

  const defaults = defaultsForEnvironment(props);
  const vpc = new Vpc(scope, `${id}Vpc`, createVpcProps(props, defaults));

  return {
    vpc,
    dataSubnets: vpc.isolatedSubnets,
  };
};

export const createNetworkingVpc = (
  scope: Construct,
  id: string,
  props: NetworkingVpcProps,
): NetworkingVpcResources => {
  const networkingVpc = new NetworkingVpc(scope, id, props);

  return {
    vpc: networkingVpc.vpc,
    dataSubnets: networkingVpc.dataSubnets,
  };
};
