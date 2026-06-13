import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, CfnResource, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AwsSolutionsChecks } from 'cdk-nag';

import { ElastiCacheEngine, ElastiCacheReplicationGroup } from '../src/index.js';

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

const createVpc = (scope: Stack): Vpc => {
  return new Vpc(scope, 'Vpc', {
    maxAzs: 2,
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

describe('ElastiCacheReplicationGroup security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'ElastiCacheReplicationGroupSecurityStack');
    const vpc = createVpc(stack);

    const cache = new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
      env: prodEnv,
      replicationGroupId: 'security-orders-cache-prod',
      vpc,
    });

    Validations.of(vpc.node.defaultChild as CfnResource).acknowledge({
      id: 'AwsSolutions-VPC7',
      reason: 'The fixture VPC is only present to exercise the construct subnet placement.',
    });
    Validations.of(cache.authTokenSecret!.node.defaultChild as CfnResource).acknowledge({
      id: 'AwsSolutions-SMG4',
      reason:
        'ElastiCache AUTH token rotation requires coordinated client migration outside this construct.',
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('synthesizes encryption, auth, non-default port, backups, and Multi-AZ guardrails', () => {
    const stack = new Stack();
    const vpc = createVpc(stack);

    new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
      env: prodEnv,
      replicationGroupId: 'security-orders-cache-prod',
      vpc,
    });

    Template.fromStack(stack).hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      AtRestEncryptionEnabled: true,
      TransitEncryptionEnabled: true,
      TransitEncryptionMode: 'required',
      AuthToken: Match.anyValue(),
      Port: 6380,
      NumCacheClusters: 2,
      AutomaticFailoverEnabled: true,
      MultiAZEnabled: true,
      SnapshotRetentionLimit: 15,
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable guardrails', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureElastiCacheReplicationGroupStack');
    const vpc = createVpc(stack);

    Validations.of(vpc.node.defaultChild as CfnResource).acknowledge({
      id: 'AwsSolutions-VPC7',
      reason: 'The fixture VPC is only present to exercise the construct subnet placement.',
    });

    try {
      new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
        env: prodEnv,
        engine: ElastiCacheEngine.REDIS,
        authToken: 'abcdefghijklmnopqrstuvwxyz123456',
        replicationGroupId: 'insecure-orders-cache-prod',
        vpc,
        replicationGroupOverrides: {
          atRestEncryptionEnabled: false,
          transitEncryptionEnabled: false,
          authToken: '',
          port: 6379,
          multiAzEnabled: false,
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-AEC3');
      expect(validationOutput).toContain('AwsSolutions-AEC4');
      expect(validationOutput).toContain('AwsSolutions-AEC5');
      expect(validationOutput).toContain('AwsSolutions-AEC6');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
