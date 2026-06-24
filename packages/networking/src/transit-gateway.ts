import { CfnTransitGateway, CfnTransitGatewayVpcAttachment, SubnetType } from 'aws-cdk-lib/aws-ec2';
import type {
  CfnTransitGatewayProps,
  CfnTransitGatewayVpcAttachmentProps,
  ISubnet,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import type {
  CreateTransitGatewayResourceProps,
  TransitGatewayProps,
  TransitGatewayResources,
  TransitGatewayVpcAttachmentConfig,
} from './types.js';

const ENABLED = 'enable';
const DISABLED = 'disable';

const defaultTransitGatewayProps = (props: TransitGatewayProps): CfnTransitGatewayProps => {
  return {
    amazonSideAsn: props.amazonSideAsn,
    autoAcceptSharedAttachments: DISABLED,
    defaultRouteTableAssociation: DISABLED,
    defaultRouteTablePropagation: DISABLED,
    description: props.description ?? `${props.transitGatewayName} transit gateway`,
    dnsSupport: ENABLED,
    encryptionSupport: ENABLED,
    multicastSupport: DISABLED,
    securityGroupReferencingSupport: ENABLED,
    transitGatewayCidrBlocks: props.transitGatewayCidrBlocks
      ? [...props.transitGatewayCidrBlocks]
      : undefined,
    vpnEcmpSupport: ENABLED,
    tags: [
      {
        key: 'Name',
        value: props.transitGatewayName,
      },
    ],
    ...props.transitGatewayOverrides,
  };
};

const selectDefaultAttachmentSubnets = (
  attachment: TransitGatewayVpcAttachmentConfig,
): readonly ISubnet[] => {
  if (attachment.vpc.privateSubnets.length > 0) {
    return attachment.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets;
  }

  if (attachment.vpc.isolatedSubnets.length > 0) {
    return attachment.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_ISOLATED }).subnets;
  }

  return attachment.vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }).subnets;
};

const resolveAttachmentSubnetIds = (
  attachment: TransitGatewayVpcAttachmentConfig,
): readonly string[] => {
  let subnetIds: readonly string[];

  if (attachment.subnetIds !== undefined) {
    subnetIds = [...attachment.subnetIds];
  } else if (attachment.subnets) {
    subnetIds = [...attachment.vpc.selectSubnets(attachment.subnets).subnetIds];
  } else {
    subnetIds = selectDefaultAttachmentSubnets(attachment).map((subnet) => subnet.subnetId);
  }

  if (subnetIds.length === 0) {
    throw new Error(`Transit gateway attachment ${attachment.id} requires at least one subnet.`);
  }

  return subnetIds;
};

const createAttachmentProps = (
  transitGateway: CfnTransitGateway,
  attachment: TransitGatewayVpcAttachmentConfig,
): CfnTransitGatewayVpcAttachmentProps => {
  return {
    transitGatewayId: transitGateway.ref,
    vpcId: attachment.vpc.vpcId,
    subnetIds: [...resolveAttachmentSubnetIds(attachment)],
    options: {
      applianceModeSupport: DISABLED,
      dnsSupport: ENABLED,
      ipv6Support: DISABLED,
      securityGroupReferencingSupport: ENABLED,
      ...attachment.options,
    },
    tags: attachment.attachmentName
      ? [
          {
            key: 'Name',
            value: attachment.attachmentName,
          },
        ]
      : undefined,
    ...attachment.attachmentOverrides,
  };
};

export class TransitGateway extends Construct {
  public readonly transitGateway: CfnTransitGateway;
  public readonly vpcAttachments: readonly CfnTransitGatewayVpcAttachment[];

  public constructor(scope: Construct, id: string, props: TransitGatewayProps) {
    super(scope, id);

    const resources = createTransitGatewayResource({
      scope: this,
      id: 'Resource',
      props,
    });

    this.transitGateway = resources.transitGateway;
    this.vpcAttachments = resources.vpcAttachments;
  }
}

export const createTransitGatewayResource = (
  resourceProps: CreateTransitGatewayResourceProps,
): TransitGatewayResources => {
  const { scope, id, props } = resourceProps;
  const transitGateway = new CfnTransitGateway(
    scope,
    `${id}TransitGateway`,
    defaultTransitGatewayProps(props),
  );
  const vpcAttachments =
    props.vpcAttachments?.map((attachment) => {
      return new CfnTransitGatewayVpcAttachment(
        scope,
        `${id}${attachment.id}`,
        createAttachmentProps(transitGateway, attachment),
      );
    }) ?? [];

  return {
    transitGateway,
    vpcAttachments,
  };
};

export const createTransitGateway = (
  scope: Construct,
  id: string,
  props: TransitGatewayProps,
): TransitGatewayResources => {
  const transitGateway = new TransitGateway(scope, id, props);

  return {
    transitGateway: transitGateway.transitGateway,
    vpcAttachments: transitGateway.vpcAttachments,
  };
};
