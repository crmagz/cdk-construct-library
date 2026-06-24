import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import { NetworkingVpc } from '../src/index.js';

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

describe('NetworkingVpc security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'NetworkingVpcSecurityStack');

    try {
      new NetworkingVpc(stack, 'Network', {
        env: prodEnv,
        vpcName: 'security-network-prod',
      });

      expect(() => app.synth()).not.toThrow();
      expect(process.exitCode).toBe(originalExitCode);
    } finally {
      process.exitCode = originalExitCode;
    }
  });

  it('synthesizes VPC flow logs by default', () => {
    const stack = new Stack();

    new NetworkingVpc(stack, 'Network', {
      env: prodEnv,
      vpcName: 'security-network-prod',
    });

    Template.fromStack(stack).hasResourceProperties('AWS::EC2::FlowLog', {
      ResourceType: 'VPC',
      TrafficType: 'ALL',
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable flow logs', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureNetworkingVpcStack');

    try {
      new NetworkingVpc(stack, 'Network', {
        env: prodEnv,
        vpcName: 'insecure-network-prod',
        vpcOverrides: {
          flowLogs: {},
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-VPC7');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
