import { EnvironmentName } from '@cdk-construct/core';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { DatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import {
  AuroraCluster,
  AuroraEngineFamily,
  createAuroraCluster,
  createAuroraClusterResource,
  createAuroraSecretResource,
} from '../src/index.js';
import type { AuroraClusterDefaults, AuroraClusterProps } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const devEnv = {
  name: EnvironmentName.DEV,
  account: '123456789012',
  region: 'us-east-1',
};

const createImportedVpc = (stack: Stack) => {
  return Vpc.fromVpcAttributes(stack, 'Vpc', {
    vpcId: 'vpc-1234567890abcdef0',
    availabilityZones: ['us-east-1a', 'us-east-1b'],
    isolatedSubnetIds: ['subnet-11111111111111111', 'subnet-22222222222222222'],
    isolatedSubnetRouteTableIds: ['rtb-11111111111111111', 'rtb-22222222222222222'],
  });
};

const defaultProps = (
  stack: Stack,
  props: Partial<AuroraClusterProps> = {},
): AuroraClusterProps => {
  return {
    env: prodEnv,
    clusterIdentifier: 'orders-prod',
    engine: AuroraEngineFamily.POSTGRESQL,
    vpc: createImportedVpc(stack),
    defaultDatabaseName: 'orders',
    credentials: {
      mode: 'secret',
      username: 'postgres',
      secretName: 'orders/prod/master',
    },
    ...props,
  };
};

const synthesizeCluster = (cluster: AuroraCluster): Template => {
  return Template.fromStack(Stack.of(cluster));
};

describe('AuroraCluster', () => {
  it('creates a production Aurora PostgreSQL cluster with secure defaults', () => {
    const stack = new Stack();
    const cluster = new AuroraCluster(stack, 'OrdersDatabase', defaultProps(stack));

    const template = synthesizeCluster(cluster);
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
    template.resourceCountIs('AWS::RDS::DBInstance', 2);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'orders/prod/master',
      GenerateSecretString: Match.objectLike({
        GenerateStringKey: 'password',
        SecretStringTemplate: Match.serializedJson(
          Match.objectLike({
            username: 'postgres',
            dbname: 'orders',
          }),
        ),
      }),
    });
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      DBClusterIdentifier: 'orders-prod',
      DatabaseName: 'orders',
      Engine: 'aurora-postgresql',
      EngineVersion: '16.6',
      StorageEncrypted: true,
      DeletionProtection: true,
      BackupRetentionPeriod: 7,
      EnableCloudwatchLogsExports: ['postgresql'],
      CopyTagsToSnapshot: true,
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

  it('creates a lower-cost non-production Aurora MySQL cluster with IAM authentication', () => {
    const stack = new Stack();
    const cluster = new AuroraCluster(
      stack,
      'OrdersDatabase',
      defaultProps(stack, {
        env: devEnv,
        clusterIdentifier: 'orders-dev',
        engine: AuroraEngineFamily.MYSQL,
        credentials: {
          mode: 'iam',
          secretName: 'orders/dev/bootstrap',
        },
      }),
    );

    const template = synthesizeCluster(cluster);
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    template.resourceCountIs('AWS::RDS::DBInstance', 1);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'orders/dev/bootstrap',
      GenerateSecretString: Match.objectLike({
        SecretStringTemplate: Match.serializedJson(
          Match.objectLike({
            username: 'admin',
          }),
        ),
      }),
    });
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      DBClusterIdentifier: 'orders-dev',
      Engine: 'aurora-mysql',
      EngineVersion: '8.0.mysql_aurora.3.08.0',
      EnableIAMDatabaseAuthentication: true,
      StorageEncrypted: true,
      DeletionProtection: false,
      BackupRetentionPeriod: 1,
      EnableCloudwatchLogsExports: ['audit', 'error', 'general', 'slowquery'],
    });
    template.hasResource('AWS::RDS::DBCluster', {
      DeletionPolicy: 'Snapshot',
      UpdateReplacePolicy: 'Snapshot',
    });
  });

  it('uses imported credentials without creating a new secret', () => {
    const stack = new Stack();

    new AuroraCluster(
      stack,
      'OrdersDatabase',
      defaultProps(stack, {
        credentials: {
          mode: 'secret',
          username: 'postgres',
          secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:orders/imported-AbCdEf',
        },
      }),
    );

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SecretsManager::Secret', 0);
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      MasterUserPassword: Match.stringLikeRegexp('orders/imported-AbCdEf'),
    });
  });

  it('honors explicit cluster settings and escape hatch overrides', () => {
    const stack = new Stack();

    new AuroraCluster(
      stack,
      'OrdersDatabase',
      defaultProps(stack, {
        backup: {
          retention: Duration.days(3),
        },
        deletionProtection: false,
        removalPolicy: RemovalPolicy.SNAPSHOT,
        cloudwatchLogsExports: ['postgresql'],
        vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
        clusterOverrides: {
          preferredMaintenanceWindow: 'Sun:23:45-Mon:00:15',
        },
      }),
    );

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      DeletionProtection: false,
      PreferredMaintenanceWindow: 'Sun:23:45-Mon:00:15',
      BackupRetentionPeriod: 3,
    });
  });

  it('validates impossible engine version combinations', () => {
    const stack = new Stack();

    expect(
      () =>
        new AuroraCluster(
          stack,
          'OrdersDatabase',
          defaultProps(stack, {
            engine: AuroraEngineFamily.MYSQL,
            postgresVersion: {} as never,
          }),
        ),
    ).toThrow('postgresVersion can only be used with aurora-postgresql');
  });

  it('prevents credential overrides that bypass the public secret API', () => {
    const stack = new Stack();

    expect(
      () =>
        new AuroraCluster(
          stack,
          'OrdersDatabase',
          defaultProps(stack, {
            clusterOverrides: {
              credentials: {} as never,
            },
          }),
        ),
    ).toThrow('clusterOverrides.credentials');
  });
});

describe('createAuroraCluster', () => {
  it('returns the cluster resources', () => {
    const stack = new Stack();
    const resources = createAuroraCluster(stack, 'Orders', defaultProps(stack));

    expect(resources.cluster).toBeInstanceOf(DatabaseCluster);
    expect(resources.secret).toBeInstanceOf(Secret);
  });
});

describe('resource creators', () => {
  it('creates explicit resources from typed resource props', () => {
    const stack = new Stack();
    const props = defaultProps(stack, { clusterIdentifier: 'orders-resource' });
    const defaults: AuroraClusterDefaults = {
      backup: {
        retention: Duration.days(3),
      },
      cloudwatchLogsExports: ['postgresql'],
      deletionProtection: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      readerCount: 0,
    };
    const secret = createAuroraSecretResource({
      scope: stack,
      id: 'Orders',
      props,
    });
    const cluster = createAuroraClusterResource({
      scope: stack,
      id: 'Orders',
      props,
      defaults,
      secret,
    });

    expect(secret).toBeInstanceOf(Secret);
    expect(cluster).toBeInstanceOf(DatabaseCluster);
  });
});
