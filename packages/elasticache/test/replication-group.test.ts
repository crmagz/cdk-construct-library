import { EnvironmentName } from '@cdk-construct/core';
import { SecretValue, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnReplicationGroup, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';

import {
  ElastiCacheEngine,
  ElastiCacheReplicationGroup,
  createAuthTokenSecretResource,
  createElastiCacheReplicationGroup,
  createReplicationGroupResource,
  createSecurityGroupResource,
  createSubnetGroupResource,
} from '../src/index.js';
import type {
  ElastiCacheReplicationGroupDefaults,
  ElastiCacheReplicationGroupProps,
} from '../src/index.js';

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

const defaultProps = (
  stack: Stack,
  props: Partial<ElastiCacheReplicationGroupProps> = {},
): ElastiCacheReplicationGroupProps => {
  return {
    env: prodEnv,
    replicationGroupId: 'orders-cache-prod',
    vpc: props.vpc ?? createVpc(stack),
    ...props,
  };
};

const defaultResourceProps = (
  stack: Stack,
  props: Partial<ElastiCacheReplicationGroupProps> = {},
): {
  readonly props: ElastiCacheReplicationGroupProps;
  readonly defaults: ElastiCacheReplicationGroupDefaults;
} => {
  return {
    props: defaultProps(stack, props),
    defaults: {
      cacheNodeType: 'cache.t4g.small',
      numCacheClusters: 2,
      snapshotRetentionLimit: 15,
    },
  };
};

describe('ElastiCacheReplicationGroup', () => {
  it('creates a production Valkey replication group with secure defaults', () => {
    const stack = new Stack();

    new ElastiCacheReplicationGroup(stack, 'OrdersCache', defaultProps(stack));

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::ElastiCache::ReplicationGroup', 1);
    template.resourceCountIs('AWS::ElastiCache::SubnetGroup', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      ReplicationGroupId: 'orders-cache-prod',
      Engine: 'valkey',
      CacheNodeType: 'cache.t4g.small',
      Port: 6380,
      NumCacheClusters: 2,
      AutomaticFailoverEnabled: true,
      MultiAZEnabled: true,
      AtRestEncryptionEnabled: true,
      TransitEncryptionEnabled: true,
      TransitEncryptionMode: 'required',
      SnapshotRetentionLimit: 15,
      AutoMinorVersionUpgrade: true,
      AuthToken: Match.anyValue(),
      CacheSubnetGroupName: {
        Ref: Match.stringLikeRegexp('OrdersCacheResourceSubnetGroup'),
      },
      SecurityGroupIds: [
        {
          'Fn::GetAtt': [Match.stringLikeRegexp('OrdersCacheResourceSecurityGroup'), 'GroupId'],
        },
      ],
    });
    template.hasResourceProperties('AWS::ElastiCache::SubnetGroup', {
      CacheSubnetGroupName: 'orders-cache-prod-subnets',
    });
  });

  it('uses smaller non-production defaults', () => {
    const stack = new Stack();

    new ElastiCacheReplicationGroup(
      stack,
      'OrdersCache',
      defaultProps(stack, {
        env: devEnv,
        replicationGroupId: 'orders-cache-dev',
      }),
    );

    Template.fromStack(stack).hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      ReplicationGroupId: 'orders-cache-dev',
      CacheNodeType: 'cache.t4g.micro',
      NumCacheClusters: 1,
      AutomaticFailoverEnabled: false,
      MultiAZEnabled: false,
      SnapshotRetentionLimit: 1,
    });
  });

  it('honors explicit replication group settings', () => {
    const stack = new Stack();

    new ElastiCacheReplicationGroup(
      stack,
      'OrdersCache',
      defaultProps(stack, {
        replicationGroupId: 'orders-cache-configured',
        description: 'Configured orders cache',
        engine: ElastiCacheEngine.REDIS,
        engineVersion: '7.1',
        cacheNodeType: 'cache.r7g.large',
        port: 6381,
        numCacheClusters: 3,
        automaticFailoverEnabled: true,
        multiAzEnabled: true,
        snapshotRetentionLimit: 10,
        snapshotWindow: '05:00-06:00',
        preferredMaintenanceWindow: 'sun:07:00-sun:08:00',
        cacheParameterGroupName: 'default.redis7',
        authToken: SecretValue.secretsManager('orders/cache/auth-token'),
      }),
    );

    Template.fromStack(stack).hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      ReplicationGroupId: 'orders-cache-configured',
      ReplicationGroupDescription: 'Configured orders cache',
      Engine: 'redis',
      EngineVersion: '7.1',
      CacheNodeType: 'cache.r7g.large',
      Port: 6381,
      NumCacheClusters: 3,
      AutomaticFailoverEnabled: true,
      MultiAZEnabled: true,
      SnapshotRetentionLimit: 10,
      SnapshotWindow: '05:00-06:00',
      PreferredMaintenanceWindow: 'sun:07:00-sun:08:00',
      CacheParameterGroupName: 'default.redis7',
      AuthToken: '{{resolve:secretsmanager:orders/cache/auth-token:SecretString:::}}',
    });
  });

  it('does not create an auth token secret when authToken is provided through overrides', () => {
    const stack = new Stack();

    new ElastiCacheReplicationGroup(
      stack,
      'OrdersCache',
      defaultProps(stack, {
        replicationGroupId: 'orders-cache-no-auth',
        replicationGroupOverrides: {
          authToken: '',
        },
      }),
    );

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SecretsManager::Secret', 0);
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      AuthToken: '',
    });
  });

  it('omits user group ids when the configured list is empty', () => {
    const stack = new Stack();

    new ElastiCacheReplicationGroup(
      stack,
      'OrdersCache',
      defaultProps(stack, {
        replicationGroupId: 'orders-cache-empty-user-groups',
        userGroupIds: [],
      }),
    );

    Template.fromStack(stack).hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      UserGroupIds: Match.absent(),
    });
  });

  it('allows subnet group, security group, and replication group overrides', () => {
    const stack = new Stack();
    const vpc = createVpc(stack);
    const additionalSecurityGroup = new SecurityGroup(stack, 'AdditionalSecurityGroup', { vpc });

    new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
      ...defaultProps(stack, {
        vpc,
        replicationGroupId: 'orders-cache-override',
      }),
      additionalSecurityGroups: [additionalSecurityGroup],
      subnetGroupOverrides: {
        cacheSubnetGroupName: 'orders-cache-private',
      },
      securityGroupOverrides: {
        allowAllOutbound: false,
      },
      replicationGroupOverrides: {
        port: 6382,
        snapshotRetentionLimit: 21,
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ElastiCache::SubnetGroup', {
      CacheSubnetGroupName: 'orders-cache-private',
    });
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Port: 6382,
      SnapshotRetentionLimit: 21,
      SecurityGroupIds: Match.arrayWith([
        {
          'Fn::GetAtt': [Match.stringLikeRegexp('AdditionalSecurityGroup'), 'GroupId'],
        },
      ]),
    });
  });

  it('adds ingress from allowed client security groups', () => {
    const stack = new Stack();
    const vpc = createVpc(stack);
    const clientSecurityGroup = new SecurityGroup(stack, 'ClientSecurityGroup', { vpc });

    new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
      ...defaultProps(stack, {
        vpc,
        replicationGroupId: 'orders-cache-clients',
      }),
      allowedClientSecurityGroups: [clientSecurityGroup],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 6380,
          ToPort: 6380,
          SourceSecurityGroupId: {
            'Fn::GetAtt': [Match.stringLikeRegexp('ClientSecurityGroup'), 'GroupId'],
          },
        }),
      ]),
    });
  });

  it('uses replication group override port for client security group ingress', () => {
    const stack = new Stack();
    const vpc = createVpc(stack);
    const clientSecurityGroup = new SecurityGroup(stack, 'ClientSecurityGroup', { vpc });

    new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
      ...defaultProps(stack, {
        vpc,
        replicationGroupId: 'orders-cache-override-port-clients',
        port: 6380,
      }),
      allowedClientSecurityGroups: [clientSecurityGroup],
      replicationGroupOverrides: {
        port: 6382,
      },
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Port: 6382,
    });
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 6382,
          ToPort: 6382,
          SourceSecurityGroupId: {
            'Fn::GetAtt': [Match.stringLikeRegexp('ClientSecurityGroup'), 'GroupId'],
          },
        }),
      ]),
    });
  });

  it('rejects automatic failover when only one cache cluster is configured', () => {
    const stack = new Stack();

    expect(() => {
      new ElastiCacheReplicationGroup(
        stack,
        'OrdersCache',
        defaultProps(stack, {
          automaticFailoverEnabled: true,
          numCacheClusters: 1,
          replicationGroupId: 'orders-cache-invalid-failover',
        }),
      );
    }).toThrow(
      'ElastiCacheReplicationGroup automaticFailoverEnabled requires at least two cache clusters.',
    );
  });

  it('rejects Multi-AZ when automatic failover is disabled', () => {
    const stack = new Stack();

    expect(() => {
      new ElastiCacheReplicationGroup(
        stack,
        'OrdersCache',
        defaultProps(stack, {
          automaticFailoverEnabled: false,
          multiAzEnabled: true,
          numCacheClusters: 2,
          replicationGroupId: 'orders-cache-invalid-multi-az',
        }),
      );
    }).toThrow('ElastiCacheReplicationGroup multiAzEnabled requires automaticFailoverEnabled.');
  });
});

describe('createElastiCacheReplicationGroup', () => {
  it('returns the created resources', () => {
    const stack = new Stack();
    const resources = createElastiCacheReplicationGroup(stack, 'OrdersCache', defaultProps(stack));

    expect(resources.replicationGroup).toBeInstanceOf(CfnReplicationGroup);
    expect(resources.subnetGroup).toBeInstanceOf(CfnSubnetGroup);
    expect(resources.securityGroup).toBeInstanceOf(SecurityGroup);
    expect(resources.authTokenSecret).toBeDefined();
  });
});

describe('resource creators', () => {
  it('create explicit resources from typed resource props', () => {
    const stack = new Stack();
    const { props, defaults } = defaultResourceProps(stack, {
      replicationGroupId: 'orders-cache-resource',
    });
    const subnetGroup = createSubnetGroupResource({ scope: stack, id: 'Orders', props });
    const securityGroup = createSecurityGroupResource({ scope: stack, id: 'Orders', props });
    const authTokenSecret = createAuthTokenSecretResource({ scope: stack, id: 'Orders', props });
    const replicationGroup = createReplicationGroupResource({
      scope: stack,
      id: 'Orders',
      props,
      defaults,
      subnetGroup,
      securityGroup,
      authTokenSecret,
    });

    expect(subnetGroup).toBeInstanceOf(CfnSubnetGroup);
    expect(securityGroup).toBeInstanceOf(SecurityGroup);
    expect(authTokenSecret).toBeDefined();
    expect(replicationGroup).toBeInstanceOf(CfnReplicationGroup);
    Template.fromStack(stack).resourceCountIs('AWS::ElastiCache::ReplicationGroup', 1);
  });
});
