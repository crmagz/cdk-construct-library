import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type {
  FlowLogOptions,
  IIpAddresses,
  SubnetConfiguration,
  Vpc,
  VpcProps,
} from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

export type NetworkingVpcProps = EnvironmentAwareProps & {
  readonly vpcName: string;
  readonly cidrBlock?: string;
  readonly ipAddresses?: IIpAddresses;
  readonly maxAzs?: number;
  readonly availabilityZones?: readonly string[];
  readonly natGateways?: number;
  readonly subnetConfiguration?: readonly SubnetConfiguration[];
  readonly flowLogs?: Record<string, FlowLogOptions>;
  readonly vpcOverrides?: CdkOverrides<VpcProps>;
};

export type NetworkingVpcDefaults = {
  readonly availabilityZones?: readonly string[];
  readonly maxAzs: number;
  readonly natGateways: number;
  readonly subnetConfiguration: readonly SubnetConfiguration[];
};

export type NetworkingVpcResources = {
  readonly vpc: Vpc;
};

export type CreateNetworkingVpcResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: NetworkingVpcProps;
};
