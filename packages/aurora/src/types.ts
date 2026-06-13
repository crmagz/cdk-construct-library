import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type {
  InstanceClass,
  InstanceSize,
  InstanceType,
  ISecurityGroup,
  IVpc,
  SubnetSelection,
} from 'aws-cdk-lib/aws-ec2';
import type { IKey } from 'aws-cdk-lib/aws-kms';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';
import type {
  AuroraMysqlEngineVersion,
  AuroraPostgresEngineVersion,
  BackupProps,
  DatabaseCluster,
  DatabaseClusterProps,
  DatabaseSecretProps,
  IClusterInstance,
  IParameterGroup,
  PerformanceInsightRetention,
} from 'aws-cdk-lib/aws-rds';
import type { ISecret, ReplicaRegion, SecretAttributes } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export const AuroraEngineFamily = {
  POSTGRESQL: 'aurora-postgresql',
  MYSQL: 'aurora-mysql',
} as const;

export type AuroraEngineFamily = (typeof AuroraEngineFamily)[keyof typeof AuroraEngineFamily];
export type AuroraAuthenticationMode = 'secret' | 'iam';

export type AuroraSecretCredentialsProps = {
  readonly mode: 'secret';
  readonly username: string;
  readonly secretName?: string;
  readonly secretArn?: string;
  readonly secretAttributes?: SecretAttributes;
  readonly encryptionKey?: IKey;
  readonly excludeCharacters?: string;
  readonly replicaRegions?: ReplicaRegion[];
  readonly replaceOnPasswordCriteriaChanges?: boolean;
  readonly secretOverrides?: CdkOverrides<DatabaseSecretProps>;
};

export type AuroraIamCredentialsProps = {
  readonly mode: 'iam';
  readonly username?: string;
  readonly secretName?: string;
  readonly encryptionKey?: IKey;
  readonly excludeCharacters?: string;
  readonly replicaRegions?: ReplicaRegion[];
  readonly replaceOnPasswordCriteriaChanges?: boolean;
  readonly secretOverrides?: CdkOverrides<DatabaseSecretProps>;
};

export type AuroraCredentialsProps = AuroraSecretCredentialsProps | AuroraIamCredentialsProps;

export type AuroraClusterProps = EnvironmentAwareProps & {
  readonly clusterIdentifier: string;
  readonly engine: AuroraEngineFamily;
  readonly vpc: IVpc;
  readonly credentials: AuroraCredentialsProps;
  readonly defaultDatabaseName?: string;
  readonly postgresVersion?: AuroraPostgresEngineVersion;
  readonly mysqlVersion?: AuroraMysqlEngineVersion;
  readonly port?: number;
  readonly writer?: IClusterInstance;
  readonly readers?: IClusterInstance[];
  readonly instanceType?: InstanceType;
  readonly instanceClass?: InstanceClass;
  readonly instanceSize?: InstanceSize;
  readonly vpcSubnets?: SubnetSelection;
  readonly securityGroups?: ISecurityGroup[];
  readonly backup?: BackupProps;
  readonly deletionProtection?: boolean;
  readonly removalPolicy?: RemovalPolicy;
  readonly cloudwatchLogsExports?: string[];
  readonly cloudwatchLogsRetention?: RetentionDays;
  readonly storageEncryptionKey?: IKey;
  readonly parameterGroup?: IParameterGroup;
  readonly parameters?: Record<string, string>;
  readonly serverlessV2MinCapacity?: number;
  readonly serverlessV2MaxCapacity?: number;
  readonly monitoringInterval?: Duration;
  readonly enablePerformanceInsights?: boolean;
  readonly performanceInsightRetention?: PerformanceInsightRetention;
  readonly performanceInsightEncryptionKey?: IKey;
  readonly clusterOverrides?: CdkOverrides<DatabaseClusterProps>;
};

export type AuroraClusterDefaults = {
  readonly backup: BackupProps;
  readonly cloudwatchLogsExports: string[];
  readonly deletionProtection: boolean;
  readonly removalPolicy: RemovalPolicy;
  readonly readerCount: number;
};

export type AuroraClusterResources = {
  readonly cluster: DatabaseCluster;
  readonly secret?: ISecret;
};

export type AuroraSecretResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: AuroraClusterProps;
};

export type AuroraClusterResourceProps = AuroraSecretResourceProps & {
  readonly defaults: AuroraClusterDefaults;
  readonly secret?: ISecret;
};

export type CreateAuroraClusterResourceProps = AuroraSecretResourceProps;
