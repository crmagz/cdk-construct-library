import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { SecretValue } from 'aws-cdk-lib';
import { Peer, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup, SecurityGroupProps, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { CfnReplicationGroup, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import type { CfnReplicationGroupProps } from 'aws-cdk-lib/aws-elasticache';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import { ElastiCacheEngine } from './types.js';
import type {
  CreateElastiCacheReplicationGroupResourceProps,
  ElastiCacheAuthTokenSecretResourceProps,
  ElastiCacheReplicationGroupDefaults,
  ElastiCacheReplicationGroupProps,
  ElastiCacheReplicationGroupResourceProps,
  ElastiCacheReplicationGroupResources,
  ElastiCacheSecurityGroupResourceProps,
  ElastiCacheSubnetGroupResourceProps,
} from './types.js';

const DEFAULT_ENGINE = ElastiCacheEngine.VALKEY;
const DEFAULT_PORT = 6380;
const DEFAULT_PROD_CACHE_NODE_TYPE = 'cache.t4g.small';
const DEFAULT_NON_PROD_CACHE_NODE_TYPE = 'cache.t4g.micro';
const DEFAULT_PROD_CACHE_CLUSTERS = 2;
const DEFAULT_NON_PROD_CACHE_CLUSTERS = 1;
const DEFAULT_PROD_SNAPSHOT_RETENTION_LIMIT = 15;
const DEFAULT_NON_PROD_SNAPSHOT_RETENTION_LIMIT = 1;
const AUTH_TOKEN_LENGTH = 32;

const defaultsForEnvironment = (
  props: ElastiCacheReplicationGroupProps,
): ElastiCacheReplicationGroupDefaults => {
  const environment = resolveEnvironmentConfig(props);

  if (isProductionEnvironment(environment)) {
    return {
      cacheNodeType: DEFAULT_PROD_CACHE_NODE_TYPE,
      numCacheClusters: DEFAULT_PROD_CACHE_CLUSTERS,
      snapshotRetentionLimit: DEFAULT_PROD_SNAPSHOT_RETENTION_LIMIT,
    };
  }

  return {
    cacheNodeType: DEFAULT_NON_PROD_CACHE_NODE_TYPE,
    numCacheClusters: DEFAULT_NON_PROD_CACHE_CLUSTERS,
    snapshotRetentionLimit: DEFAULT_NON_PROD_SNAPSHOT_RETENTION_LIMIT,
  };
};

const defaultSubnetSelection = (props: ElastiCacheReplicationGroupProps): SubnetSelection => {
  if (props.vpc.privateSubnets.length > 0) {
    return { subnetType: SubnetType.PRIVATE_WITH_EGRESS };
  }

  if (props.vpc.isolatedSubnets.length > 0) {
    return { subnetType: SubnetType.PRIVATE_ISOLATED };
  }

  throw new Error('ElastiCacheReplicationGroup requires private or isolated VPC subnets.');
};

const resolveAuthToken = (
  props: ElastiCacheReplicationGroupProps,
  authTokenSecret: Secret | undefined,
): string | undefined => {
  if (typeof props.authToken === 'string') {
    return props.authToken;
  }

  if (SecretValue.isSecretValue(props.authToken)) {
    return props.authToken.unsafeUnwrap();
  }

  return authTokenSecret?.secretValue.unsafeUnwrap();
};

const createSecurityGroupProps = (props: ElastiCacheReplicationGroupProps): SecurityGroupProps => {
  return {
    vpc: props.vpc,
    securityGroupName: props.securityGroupName,
    description:
      props.securityGroupDescription ??
      `Controls client access to ${props.replicationGroupId} ElastiCache`,
    allowAllOutbound: false,
    ...props.securityGroupOverrides,
  };
};

const grantClientAccess = (
  securityGroup: ISecurityGroup,
  props: ElastiCacheReplicationGroupProps,
): void => {
  props.allowedClientSecurityGroups?.forEach((clientSecurityGroup) => {
    securityGroup.addIngressRule(
      Peer.securityGroupId(clientSecurityGroup.securityGroupId),
      Port.tcp(props.port ?? DEFAULT_PORT),
      `Allow ${clientSecurityGroup.securityGroupId} to connect to ElastiCache`,
    );
  });
};

const resolveSecurityGroups = (
  props: ElastiCacheReplicationGroupProps,
  securityGroup: ISecurityGroup,
): readonly ISecurityGroup[] => {
  return [securityGroup, ...(props.additionalSecurityGroups ?? [])];
};

const createReplicationGroupProps = (
  resourceProps: ElastiCacheReplicationGroupResourceProps,
): CfnReplicationGroupProps => {
  const { props, defaults, subnetGroup, securityGroup, authTokenSecret } = resourceProps;
  const environment = resolveEnvironmentConfig(props);
  const numCacheClusters = props.numCacheClusters ?? defaults.numCacheClusters;
  const automaticFailoverEnabled = props.automaticFailoverEnabled ?? numCacheClusters > 1;
  const multiAzEnabled = props.multiAzEnabled ?? automaticFailoverEnabled;

  return {
    replicationGroupId: props.replicationGroupId,
    replicationGroupDescription:
      props.description ??
      `${props.replicationGroupId} ${environment.name} ElastiCache replication group`,
    engine: props.engine ?? DEFAULT_ENGINE,
    engineVersion: props.engineVersion,
    cacheNodeType: props.cacheNodeType ?? defaults.cacheNodeType,
    cacheSubnetGroupName: subnetGroup.ref,
    securityGroupIds: resolveSecurityGroups(props, securityGroup).map(
      (group) => group.securityGroupId,
    ),
    port: props.port ?? DEFAULT_PORT,
    numCacheClusters,
    automaticFailoverEnabled,
    multiAzEnabled,
    atRestEncryptionEnabled: true,
    transitEncryptionEnabled: true,
    transitEncryptionMode: 'required',
    authToken: resolveAuthToken(props, authTokenSecret),
    snapshotRetentionLimit: props.snapshotRetentionLimit ?? defaults.snapshotRetentionLimit,
    snapshotWindow: props.snapshotWindow,
    preferredMaintenanceWindow: props.preferredMaintenanceWindow,
    autoMinorVersionUpgrade: true,
    cacheParameterGroupName: props.cacheParameterGroupName,
    kmsKeyId: props.kmsKeyId,
    userGroupIds: props.userGroupIds ? [...props.userGroupIds] : undefined,
    logDeliveryConfigurations: props.logDeliveryConfigurations,
    ...props.replicationGroupOverrides,
  };
};

export class ElastiCacheReplicationGroup extends Construct {
  public readonly replicationGroup: CfnReplicationGroup;
  public readonly subnetGroup: CfnSubnetGroup;
  public readonly securityGroup: ISecurityGroup;
  public readonly authTokenSecret?: Secret;

  public constructor(scope: Construct, id: string, props: ElastiCacheReplicationGroupProps) {
    super(scope, id);

    const resources = createElastiCacheReplicationGroupResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.replicationGroup = resources.replicationGroup;
    this.subnetGroup = resources.subnetGroup;
    this.securityGroup = resources.securityGroup;
    this.authTokenSecret = resources.authTokenSecret;
  }
}

export const createSubnetGroupResource = (
  resourceProps: ElastiCacheSubnetGroupResourceProps,
): CfnSubnetGroup => {
  const { scope, id, props } = resourceProps;
  const subnetIds = props.vpc.selectSubnets(
    props.vpcSubnets ?? defaultSubnetSelection(props),
  ).subnetIds;

  if (subnetIds.length === 0) {
    throw new Error('ElastiCacheReplicationGroup requires at least one selected subnet.');
  }

  return new CfnSubnetGroup(scope, `${id}SubnetGroup`, {
    cacheSubnetGroupName: props.subnetGroupName ?? `${props.replicationGroupId}-subnets`,
    description:
      props.subnetGroupDescription ?? `Subnet group for ${props.replicationGroupId} ElastiCache`,
    subnetIds,
    ...props.subnetGroupOverrides,
  });
};

export const createSecurityGroupResource = (
  resourceProps: ElastiCacheSecurityGroupResourceProps,
): ISecurityGroup => {
  const { scope, id, props } = resourceProps;
  const securityGroup =
    props.securityGroup ??
    new SecurityGroup(scope, `${id}SecurityGroup`, createSecurityGroupProps(props));

  grantClientAccess(securityGroup, props);

  return securityGroup;
};

export const createAuthTokenSecretResource = (
  resourceProps: ElastiCacheAuthTokenSecretResourceProps,
): Secret | undefined => {
  const { scope, id, props } = resourceProps;

  if (props.authToken !== undefined) {
    return undefined;
  }

  return new Secret(scope, `${id}AuthToken`, {
    description: `Auth token for ${props.replicationGroupId} ElastiCache`,
    generateSecretString: {
      excludePunctuation: true,
      includeSpace: false,
      passwordLength: AUTH_TOKEN_LENGTH,
    },
  });
};

export const createReplicationGroupResource = (
  resourceProps: ElastiCacheReplicationGroupResourceProps,
): CfnReplicationGroup => {
  const { scope, id } = resourceProps;

  return new CfnReplicationGroup(
    scope,
    `${id}ReplicationGroup`,
    createReplicationGroupProps(resourceProps),
  );
};

export const createElastiCacheReplicationGroupResources = (
  resourceProps: CreateElastiCacheReplicationGroupResourceProps,
): ElastiCacheReplicationGroupResources => {
  const defaults = defaultsForEnvironment(resourceProps.props);
  const subnetGroup = createSubnetGroupResource(resourceProps);
  const securityGroup = createSecurityGroupResource(resourceProps);
  const authTokenSecret = createAuthTokenSecretResource(resourceProps);
  const replicationGroup = createReplicationGroupResource({
    ...resourceProps,
    defaults,
    subnetGroup,
    securityGroup,
    authTokenSecret,
  });

  return {
    replicationGroup,
    subnetGroup,
    securityGroup,
    authTokenSecret,
  };
};

export const createElastiCacheReplicationGroup = (
  scope: Construct,
  id: string,
  props: ElastiCacheReplicationGroupProps,
): ElastiCacheReplicationGroupResources => {
  const replicationGroup = new ElastiCacheReplicationGroup(scope, id, props);

  return {
    replicationGroup: replicationGroup.replicationGroup,
    subnetGroup: replicationGroup.subnetGroup,
    securityGroup: replicationGroup.securityGroup,
    authTokenSecret: replicationGroup.authTokenSecret,
  };
};
