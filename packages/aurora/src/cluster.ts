import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, SubnetType } from 'aws-cdk-lib/aws-ec2';
import {
  AuroraMysqlEngineVersion,
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  DatabaseSecret,
} from 'aws-cdk-lib/aws-rds';
import type {
  DatabaseClusterProps,
  DatabaseSecretProps,
  IClusterEngine,
  IClusterInstance,
} from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

import { AuroraEngineFamily } from './types.js';
import type {
  AuroraClusterDefaults,
  AuroraClusterProps,
  AuroraClusterResourceProps,
  AuroraClusterResources,
  AuroraSecretResourceProps,
  CreateAuroraClusterResourceProps,
} from './types.js';

const DEFAULT_PROD_BACKUP_RETENTION = Duration.days(7);
const DEFAULT_NON_PROD_BACKUP_RETENTION = Duration.days(1);
const DEFAULT_POSTGRES_USERNAME = 'postgres';
const DEFAULT_MYSQL_USERNAME = 'admin';
const DEFAULT_EXCLUDE_CHARACTERS = ' %+~`#$&*()|[]{}:;<>?!\'/@"\\';

const defaultsForEnvironment = (props: AuroraClusterProps): AuroraClusterDefaults => {
  const environment = resolveEnvironmentConfig(props);
  const production = isProductionEnvironment(environment);

  return {
    backup: {
      retention: production ? DEFAULT_PROD_BACKUP_RETENTION : DEFAULT_NON_PROD_BACKUP_RETENTION,
    },
    cloudwatchLogsExports:
      props.engine === AuroraEngineFamily.POSTGRESQL
        ? ['postgresql']
        : ['audit', 'error', 'general', 'slowquery'],
    deletionProtection: production,
    removalPolicy: production ? RemovalPolicy.RETAIN : RemovalPolicy.SNAPSHOT,
    readerCount: production ? 1 : 0,
  };
};

const defaultUsernameForEngine = (props: AuroraClusterProps): string => {
  return props.engine === AuroraEngineFamily.POSTGRESQL
    ? DEFAULT_POSTGRES_USERNAME
    : DEFAULT_MYSQL_USERNAME;
};

const resolveEngine = (props: AuroraClusterProps): IClusterEngine => {
  if (props.postgresVersion && props.engine !== AuroraEngineFamily.POSTGRESQL) {
    throw new Error('AuroraCluster postgresVersion can only be used with aurora-postgresql.');
  }

  if (props.mysqlVersion && props.engine !== AuroraEngineFamily.MYSQL) {
    throw new Error('AuroraCluster mysqlVersion can only be used with aurora-mysql.');
  }

  switch (props.engine) {
    case AuroraEngineFamily.POSTGRESQL:
      return DatabaseClusterEngine.auroraPostgres({
        version: props.postgresVersion ?? AuroraPostgresEngineVersion.VER_16_6,
      });
    case AuroraEngineFamily.MYSQL:
      return DatabaseClusterEngine.auroraMysql({
        version: props.mysqlVersion ?? AuroraMysqlEngineVersion.VER_3_08_0,
      });
  }
};

const resolveInstanceType = (props: AuroraClusterProps): InstanceType => {
  if (props.instanceType && (props.instanceClass || props.instanceSize)) {
    throw new Error(
      'AuroraCluster instanceType cannot be combined with instanceClass or instanceSize.',
    );
  }

  return (
    props.instanceType ??
    InstanceType.of(
      props.instanceClass ?? InstanceClass.BURSTABLE4_GRAVITON,
      props.instanceSize ?? InstanceSize.MEDIUM,
    )
  );
};

const createWriter = (props: AuroraClusterProps): IClusterInstance => {
  return (
    props.writer ??
    ClusterInstance.provisioned('Writer', {
      instanceType: resolveInstanceType(props),
      publiclyAccessible: false,
      enablePerformanceInsights: props.enablePerformanceInsights,
      performanceInsightRetention: props.performanceInsightRetention,
      performanceInsightEncryptionKey: props.performanceInsightEncryptionKey,
    })
  );
};

const createReaders = (
  props: AuroraClusterProps,
  defaults: AuroraClusterDefaults,
): IClusterInstance[] => {
  if (props.readers) {
    return [...props.readers];
  }

  return [...Array(defaults.readerCount).keys()].map((readerIndex) =>
    ClusterInstance.provisioned(`Reader${readerIndex + 1}`, {
      instanceType: resolveInstanceType(props),
      publiclyAccessible: false,
      enablePerformanceInsights: props.enablePerformanceInsights,
      performanceInsightRetention: props.performanceInsightRetention,
      performanceInsightEncryptionKey: props.performanceInsightEncryptionKey,
    }),
  );
};

const validateCredentials = (props: AuroraClusterProps): void => {
  const credentials = props.credentials;

  if (
    credentials.mode === 'secret' &&
    [credentials.secretArn, credentials.secretAttributes].filter(Boolean).length > 1
  ) {
    throw new Error(
      'AuroraCluster credentials can import a secret by ARN or attributes, not both.',
    );
  }
};

const validateOverrides = (props: AuroraClusterProps): void => {
  const clusterOverrides = props.clusterOverrides as Record<string, unknown> | undefined;

  if (!clusterOverrides) {
    return;
  }

  if ('credentials' in clusterOverrides) {
    throw new Error('AuroraCluster does not allow clusterOverrides.credentials; use credentials.');
  }

  if ('engine' in clusterOverrides) {
    throw new Error('AuroraCluster does not allow clusterOverrides.engine; use engine.');
  }

  if ('vpc' in clusterOverrides) {
    throw new Error('AuroraCluster does not allow clusterOverrides.vpc; use vpc.');
  }

  if ('writer' in clusterOverrides) {
    throw new Error('AuroraCluster does not allow clusterOverrides.writer; use writer.');
  }

  if ('readers' in clusterOverrides) {
    throw new Error('AuroraCluster does not allow clusterOverrides.readers; use readers.');
  }
};

const validateProps = (props: AuroraClusterProps): void => {
  validateCredentials(props);
  validateOverrides(props);

  if (props.parameterGroup && props.parameters) {
    throw new Error('AuroraCluster cannot specify both parameterGroup and parameters.');
  }

  if (props.serverlessV2MinCapacity !== undefined && props.serverlessV2MaxCapacity === undefined) {
    throw new Error(
      'AuroraCluster serverlessV2MaxCapacity is required with serverlessV2MinCapacity.',
    );
  }
};

const createSecretProps = (props: AuroraClusterProps): DatabaseSecretProps => {
  const credentials = props.credentials;

  return {
    username:
      credentials.mode === 'secret'
        ? credentials.username
        : (credentials.username ?? defaultUsernameForEngine(props)),
    dbname: props.defaultDatabaseName,
    secretName: credentials.secretName,
    encryptionKey: credentials.encryptionKey,
    excludeCharacters: credentials.excludeCharacters ?? DEFAULT_EXCLUDE_CHARACTERS,
    replicaRegions: credentials.replicaRegions,
    replaceOnPasswordCriteriaChanges: credentials.replaceOnPasswordCriteriaChanges,
    ...credentials.secretOverrides,
  };
};

const resolveCredentialsSecret = (
  resourceProps: AuroraSecretResourceProps,
): ISecret | undefined => {
  const { scope, id, props } = resourceProps;
  const credentials = props.credentials;

  if (credentials.mode === 'secret' && credentials.secretArn) {
    return Secret.fromSecretCompleteArn(scope, `${id}Secret`, credentials.secretArn);
  }

  if (credentials.mode === 'secret' && credentials.secretAttributes) {
    return Secret.fromSecretAttributes(scope, `${id}Secret`, credentials.secretAttributes);
  }

  return undefined;
};

const createClusterProps = (
  props: AuroraClusterProps,
  defaults: AuroraClusterDefaults,
  secret: ISecret,
): DatabaseClusterProps => {
  return {
    engine: resolveEngine(props),
    credentials: Credentials.fromSecret(secret),
    vpc: props.vpc,
    vpcSubnets: props.vpcSubnets ?? { subnetType: SubnetType.PRIVATE_ISOLATED },
    securityGroups: props.securityGroups,
    clusterIdentifier: props.clusterIdentifier,
    defaultDatabaseName: props.defaultDatabaseName,
    port: props.port,
    writer: createWriter(props),
    readers: createReaders(props, defaults),
    backup: props.backup ?? defaults.backup,
    deletionProtection: props.deletionProtection ?? defaults.deletionProtection,
    removalPolicy: props.removalPolicy ?? defaults.removalPolicy,
    storageEncrypted: true,
    storageEncryptionKey: props.storageEncryptionKey,
    iamAuthentication: props.credentials.mode === 'iam',
    cloudwatchLogsExports: props.cloudwatchLogsExports ?? defaults.cloudwatchLogsExports,
    cloudwatchLogsRetention: props.cloudwatchLogsRetention,
    parameterGroup: props.parameterGroup,
    parameters: props.parameters,
    serverlessV2MinCapacity: props.serverlessV2MinCapacity,
    serverlessV2MaxCapacity: props.serverlessV2MaxCapacity,
    monitoringInterval: props.monitoringInterval,
    enablePerformanceInsights: props.enablePerformanceInsights,
    performanceInsightRetention: props.performanceInsightRetention,
    performanceInsightEncryptionKey: props.performanceInsightEncryptionKey,
    copyTagsToSnapshot: true,
    ...props.clusterOverrides,
  };
};

export class AuroraCluster extends Construct {
  public readonly cluster: DatabaseCluster;
  public readonly secret?: ISecret;

  public constructor(scope: Construct, id: string, props: AuroraClusterProps) {
    super(scope, id);

    const resources = createAuroraClusterResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.cluster = resources.cluster;
    this.secret = resources.secret;
  }
}

export const createAuroraSecretResource = (resourceProps: AuroraSecretResourceProps): ISecret => {
  const importedSecret = resolveCredentialsSecret(resourceProps);

  if (importedSecret) {
    return importedSecret;
  }

  return new DatabaseSecret(
    resourceProps.scope,
    `${resourceProps.id}Secret`,
    createSecretProps(resourceProps.props),
  );
};

export const createAuroraClusterResource = (
  resourceProps: AuroraClusterResourceProps,
): DatabaseCluster => {
  const { scope, id, props, defaults, secret } = resourceProps;

  if (!secret) {
    throw new Error('AuroraCluster requires a credentials secret to create the cluster.');
  }

  return new DatabaseCluster(scope, `${id}Cluster`, createClusterProps(props, defaults, secret));
};

export const createAuroraClusterResources = (
  resourceProps: CreateAuroraClusterResourceProps,
): AuroraClusterResources => {
  validateProps(resourceProps.props);

  const defaults = defaultsForEnvironment(resourceProps.props);
  const secret = createAuroraSecretResource(resourceProps);
  const cluster = createAuroraClusterResource({
    ...resourceProps,
    defaults,
    secret,
  });

  return { cluster, secret };
};

export const createAuroraCluster = (
  scope: Construct,
  id: string,
  props: AuroraClusterProps,
): AuroraClusterResources => {
  const auroraCluster = new AuroraCluster(scope, id, props);

  return {
    cluster: auroraCluster.cluster,
    secret: auroraCluster.secret,
  };
};
