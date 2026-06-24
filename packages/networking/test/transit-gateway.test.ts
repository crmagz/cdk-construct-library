import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';

import { NetworkingVpc, TransitGateway, createTransitGateway } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createAttachmentVpc = (stack: Stack): NetworkingVpc => {
  return new NetworkingVpc(stack, 'Network', {
    env: prodEnv,
    vpcName: 'attachment-network-prod',
    availabilityZones: ['us-east-1a', 'us-east-1b'],
    natGateways: 0,
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: 'isolated',
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    ],
  });
};

describe('TransitGateway', () => {
  it('synthesizes a transit gateway with secure routing defaults', () => {
    const stack = new Stack();

    new TransitGateway(stack, 'Transit', {
      env: prodEnv,
      transitGatewayName: 'core-network-prod',
      amazonSideAsn: 64520,
    });

    Template.fromStack(stack).hasResourceProperties('AWS::EC2::TransitGateway', {
      AmazonSideAsn: 64520,
      AutoAcceptSharedAttachments: 'disable',
      DefaultRouteTableAssociation: 'disable',
      DefaultRouteTablePropagation: 'disable',
      DnsSupport: 'enable',
      EncryptionSupport: 'enable',
      MulticastSupport: 'disable',
      SecurityGroupReferencingSupport: 'enable',
      VpnEcmpSupport: 'enable',
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Name',
          Value: 'core-network-prod',
        }),
      ]),
    });
  });

  it('creates VPC attachments from selected VPC subnets', () => {
    const stack = new Stack();
    const network = createAttachmentVpc(stack);

    const transit = createTransitGateway(stack, 'Transit', {
      env: prodEnv,
      transitGatewayName: 'core-network-prod',
      vpcAttachments: [
        {
          id: 'ApplicationAttachment',
          attachmentName: 'application-network-prod',
          vpc: network.vpc,
        },
      ],
    });

    expect(transit.vpcAttachments).toHaveLength(1);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::TransitGatewayVpcAttachment', {
      Options: {
        applianceModeSupport: 'disable',
        dnsSupport: 'enable',
        ipv6Support: 'disable',
        securityGroupReferencingSupport: 'enable',
      },
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Name',
          Value: 'application-network-prod',
        }),
      ]),
    });

    const attachments = template.findResources('AWS::EC2::TransitGatewayVpcAttachment');
    const attachment = Object.values(attachments)[0];
    expect(attachment.Properties.SubnetIds).toHaveLength(2);
  });

  it('requires at least one subnet for each VPC attachment', () => {
    const stack = new Stack();
    const network = createAttachmentVpc(stack);

    expect(() => {
      new TransitGateway(stack, 'Transit', {
        env: prodEnv,
        transitGatewayName: 'core-network-prod',
        vpcAttachments: [
          {
            id: 'ApplicationAttachment',
            vpc: network.vpc,
            subnetIds: [],
          },
        ],
      });
    }).toThrow('Transit gateway attachment ApplicationAttachment requires at least one subnet.');
  });
});
