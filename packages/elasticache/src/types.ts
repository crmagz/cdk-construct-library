import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type { SecretValue } from 'aws-cdk-lib';
import type {
  ISecurityGroup,
  IVpc,
  SecurityGroup,
  SecurityGroupProps,
  SubnetSelection,
} from 'aws-cdk-lib/aws-ec2';
import type {
  CfnReplicationGroup,
  CfnReplicationGroupProps,
  CfnSubnetGroup,
  CfnSubnetGroupProps,
} from 'aws-cdk-lib/aws-elasticache';
import type { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export const ElastiCacheEngine = {
  VALKEY: 'valkey',
  REDIS: 'redis',
} as const;

export type ElastiCacheEngine = (typeof ElastiCacheEngine)[keyof typeof ElastiCacheEngine];

export type ElastiCacheReplicationGroupProps = EnvironmentAwareProps & {
  readonly replicationGroupId: string;
  readonly vpc: IVpc;
  readonly vpcSubnets?: SubnetSelection;
  readonly description?: string;
  readonly engine?: ElastiCacheEngine;
  readonly engineVersion?: string;
  readonly cacheNodeType?: string;
  readonly port?: number;
  readonly numCacheClusters?: number;
  readonly automaticFailoverEnabled?: boolean;
  readonly multiAzEnabled?: boolean;
  readonly snapshotRetentionLimit?: number;
  readonly snapshotWindow?: string;
  readonly preferredMaintenanceWindow?: string;
  readonly cacheParameterGroupName?: string;
  readonly kmsKeyId?: string;
  readonly authToken?: SecretValue;
  readonly userGroupIds?: readonly string[];
  readonly logDeliveryConfigurations?: CfnReplicationGroupProps['logDeliveryConfigurations'];
  readonly securityGroup?: ISecurityGroup;
  readonly additionalSecurityGroups?: readonly ISecurityGroup[];
  readonly allowedClientSecurityGroups?: readonly ISecurityGroup[];
  readonly securityGroupName?: string;
  readonly securityGroupDescription?: string;
  readonly subnetGroupName?: string;
  readonly subnetGroupDescription?: string;
  readonly securityGroupOverrides?: CdkOverrides<SecurityGroupProps>;
  readonly subnetGroupOverrides?: CdkOverrides<CfnSubnetGroupProps>;
  readonly replicationGroupOverrides?: CdkOverrides<CfnReplicationGroupProps>;
};

export type ElastiCacheReplicationGroupDefaults = {
  readonly cacheNodeType: string;
  readonly numCacheClusters: number;
  readonly snapshotRetentionLimit: number;
};

export type ElastiCacheReplicationGroupResources = {
  readonly replicationGroup: CfnReplicationGroup;
  readonly subnetGroup: CfnSubnetGroup;
  readonly securityGroup: ISecurityGroup;
  readonly authTokenSecret?: Secret;
};

export type CreateElastiCacheReplicationGroupResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ElastiCacheReplicationGroupProps;
};

export type ElastiCacheSubnetGroupResourceProps = CreateElastiCacheReplicationGroupResourceProps;

export type ElastiCacheSecurityGroupResourceProps = CreateElastiCacheReplicationGroupResourceProps;

export type ElastiCacheAuthTokenSecretResourceProps =
  CreateElastiCacheReplicationGroupResourceProps;

export type ElastiCacheReplicationGroupResourceProps =
  CreateElastiCacheReplicationGroupResourceProps & {
    readonly defaults: ElastiCacheReplicationGroupDefaults;
    readonly subnetGroup: CfnSubnetGroup;
    readonly securityGroup: SecurityGroup | ISecurityGroup;
    readonly authTokenSecret?: Secret;
  };
