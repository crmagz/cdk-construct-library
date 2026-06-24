import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import { TransitGateway } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createSecurityApp = (): App => {
  const app = new App();
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return app;
};

describe('TransitGateway security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'TransitGatewaySecurityStack');

    try {
      new TransitGateway(stack, 'Transit', {
        env: prodEnv,
        transitGatewayName: 'security-core-network-prod',
      });

      expect(() => app.synth()).not.toThrow();
      expect(process.exitCode).toBe(originalExitCode);
    } finally {
      process.exitCode = originalExitCode;
    }
  });

  it('synthesizes explicit secure defaults', () => {
    const stack = new Stack();

    new TransitGateway(stack, 'Transit', {
      env: prodEnv,
      transitGatewayName: 'security-core-network-prod',
    });

    Template.fromStack(stack).hasResourceProperties('AWS::EC2::TransitGateway', {
      AutoAcceptSharedAttachments: 'disable',
      DefaultRouteTableAssociation: 'disable',
      DefaultRouteTablePropagation: 'disable',
      DnsSupport: 'enable',
      EncryptionSupport: 'enable',
      SecurityGroupReferencingSupport: 'enable',
    });
  });

  it('canaries escape hatch overrides that disable transit gateway guardrails', () => {
    const stack = new Stack();

    new TransitGateway(stack, 'Transit', {
      env: prodEnv,
      transitGatewayName: 'insecure-core-network-prod',
      transitGatewayOverrides: {
        defaultRouteTableAssociation: 'enable',
        defaultRouteTablePropagation: 'enable',
        encryptionSupport: 'disable',
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::EC2::TransitGateway', {
      DefaultRouteTableAssociation: 'enable',
      DefaultRouteTablePropagation: 'enable',
      EncryptionSupport: 'disable',
    });
  });
});
