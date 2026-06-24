import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type {
  CfnTransitGateway,
  CfnTransitGatewayProps,
  CfnTransitGatewayVpcAttachment,
  CfnTransitGatewayVpcAttachmentProps,
  FlowLogOptions,
  IIpAddresses,
  IVpc,
  ISubnet,
  SubnetSelection,
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
  readonly dataSubnets: readonly ISubnet[];
};

export type CreateNetworkingVpcResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: NetworkingVpcProps;
};

export type TransitGatewayVpcAttachmentConfig = {
  readonly id: string;
  readonly attachmentName?: string;
  readonly vpc: IVpc;
  readonly subnets?: SubnetSelection;
  readonly subnetIds?: readonly string[];
  readonly options?: CfnTransitGatewayVpcAttachment.OptionsProperty;
  readonly attachmentOverrides?: CdkOverrides<CfnTransitGatewayVpcAttachmentProps>;
};

export type TransitGatewayProps = EnvironmentAwareProps & {
  readonly transitGatewayName: string;
  readonly description?: string;
  readonly amazonSideAsn?: number;
  readonly transitGatewayCidrBlocks?: readonly string[];
  readonly vpcAttachments?: readonly TransitGatewayVpcAttachmentConfig[];
  readonly transitGatewayOverrides?: CdkOverrides<CfnTransitGatewayProps>;
};

export type TransitGatewayResources = {
  readonly transitGateway: CfnTransitGateway;
  readonly vpcAttachments: readonly CfnTransitGatewayVpcAttachment[];
};

export type CreateTransitGatewayResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: TransitGatewayProps;
};
