import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { Construct } from 'constructs';

import { AuroraCluster, AuroraEngineFamily } from '../src/index.js';

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

const createImportedVpc = (stack: Stack) => {
  return Vpc.fromVpcAttributes(stack, 'Vpc', {
    vpcId: 'vpc-1234567890abcdef0',
    availabilityZones: ['us-east-1a', 'us-east-1b'],
    isolatedSubnetIds: ['subnet-11111111111111111', 'subnet-22222222222222222'],
    isolatedSubnetRouteTableIds: ['rtb-11111111111111111', 'rtb-22222222222222222'],
  });
};

describe('AuroraCluster security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'AuroraClusterSecurityStack');

    const cluster = new AuroraCluster(stack, 'Orders', {
      env: prodEnv,
      clusterIdentifier: 'security-orders-prod',
      engine: AuroraEngineFamily.POSTGRESQL,
      vpc: createImportedVpc(stack),
      defaultDatabaseName: 'orders',
      credentials: {
        mode: 'iam',
        username: 'postgres',
        secretName: 'security/orders/prod',
      },
    });

    const secretResource = (cluster.secret as Construct).node.defaultChild as Construct;

    Validations.of(secretResource).acknowledge({
      id: 'AwsSolutions-SMG4',
      reason:
        'The construct creates a bootstrap database secret; rotation timing is application-specific and must be enabled after database user readiness is confirmed.',
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('synthesizes encrypted clusters with private instances, retained data, and logs', () => {
    const stack = new Stack();

    new AuroraCluster(stack, 'Orders', {
      env: prodEnv,
      clusterIdentifier: 'security-orders-prod',
      engine: AuroraEngineFamily.POSTGRESQL,
      vpc: createImportedVpc(stack),
      defaultDatabaseName: 'orders',
      credentials: {
        mode: 'secret',
        username: 'postgres',
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      StorageEncrypted: true,
      DeletionProtection: true,
      EnableCloudwatchLogsExports: ['postgresql'],
      MasterUserPassword: Match.anyValue(),
    });
    template.hasResource('AWS::RDS::DBCluster', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
    template.allResourcesProperties('AWS::RDS::DBInstance', {
      PubliclyAccessible: false,
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable guardrails', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureAuroraClusterStack');

    try {
      new AuroraCluster(stack, 'Orders', {
        env: prodEnv,
        clusterIdentifier: 'insecure-orders-prod',
        engine: AuroraEngineFamily.POSTGRESQL,
        vpc: createImportedVpc(stack),
        defaultDatabaseName: 'orders',
        credentials: {
          mode: 'secret',
          username: 'postgres',
        },
        clusterOverrides: {
          storageEncrypted: false,
          deletionProtection: false,
          cloudwatchLogsExports: [],
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-RDS2');
      expect(validationOutput).toContain('AwsSolutions-RDS10');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
