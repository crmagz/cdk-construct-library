import { applyTags, isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EbsDeviceVolumeType } from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Domain, EngineVersion, TLSSecurityPolicy } from 'aws-cdk-lib/aws-opensearchservice';
import type { DomainProps, LoggingOptions } from 'aws-cdk-lib/aws-opensearchservice';
import { Construct } from 'constructs';

import type {
  CreateOpenSearchDomainResourceProps,
  OpenSearchDomainDefaults,
  OpenSearchDomainLogGroups,
  OpenSearchDomainProps,
  OpenSearchDomainResourceProps,
  OpenSearchDomainResources,
  OpenSearchLogGroupResourceProps,
} from './types.js';

const DEFAULT_INSTANCE_TYPE = 'r7g.large.search';
const DEFAULT_VOLUME_SIZE = 100;
const DEFAULT_SNAPSHOT_START_HOUR = 4;
const DEFAULT_OFF_PEAK_START = { hours: 3, minutes: 0 } as const;

export const OpenSearchVersion = {
  OPENSEARCH_2_11: EngineVersion.OPENSEARCH_2_11,
  OPENSEARCH_2_13: EngineVersion.OPENSEARCH_2_13,
  OPENSEARCH_2_15: EngineVersion.OPENSEARCH_2_15,
  OPENSEARCH_2_17: EngineVersion.OPENSEARCH_2_17,
  OPENSEARCH_2_19: EngineVersion.OPENSEARCH_2_19,
  OPENSEARCH_3_1: EngineVersion.OPENSEARCH_3_1,
  OPENSEARCH_3_3: EngineVersion.OPENSEARCH_3_3,
  OPENSEARCH_3_5: EngineVersion.OPENSEARCH_3_5,
} as const;

export type OpenSearchVersion = (typeof OpenSearchVersion)[keyof typeof OpenSearchVersion];

const productionCapacity = (): OpenSearchDomainDefaults['capacity'] => {
  return {
    masterNodes: 3,
    masterNodeInstanceType: DEFAULT_INSTANCE_TYPE,
    dataNodes: 3,
    dataNodeInstanceType: DEFAULT_INSTANCE_TYPE,
    multiAzWithStandbyEnabled: true,
  };
};

const nonProductionCapacity = (): OpenSearchDomainDefaults['capacity'] => {
  return {
    dataNodes: 1,
    dataNodeInstanceType: DEFAULT_INSTANCE_TYPE,
    multiAzWithStandbyEnabled: false,
  };
};

const productionZoneAwareness = (): OpenSearchDomainDefaults['zoneAwareness'] => {
  return {
    enabled: true,
    availabilityZoneCount: 3,
  };
};

const nonProductionZoneAwareness = (): OpenSearchDomainDefaults['zoneAwareness'] => {
  return {
    enabled: false,
  };
};

const defaultEbsOptions = (): OpenSearchDomainDefaults['ebs'] => {
  return {
    enabled: true,
    volumeSize: DEFAULT_VOLUME_SIZE,
    volumeType: EbsDeviceVolumeType.GP3,
  };
};

const defaultLoggingOptions = (props: OpenSearchDomainProps): LoggingOptions => {
  const auditLogEnabled =
    props.logging?.auditLogEnabled === true && props.fineGrainedAccessControl !== undefined;

  return {
    appLogEnabled: true,
    slowSearchLogEnabled: true,
    slowIndexLogEnabled: true,
    auditLogEnabled,
  };
};

const validateEnvironmentConfig = (props: OpenSearchDomainProps): void => {
  if (props.env?.name === undefined) {
    throw new Error(
      'Environment config is required. Pass props.env with at least an environment name.',
    );
  }
};

const validateLoggingConfig = (props: OpenSearchDomainProps): void => {
  if (props.logging?.auditLogEnabled === true && props.fineGrainedAccessControl === undefined) {
    throw new Error('OpenSearch audit logging requires fineGrainedAccessControl.');
  }
};

export const defaultsForEnvironment = (props: OpenSearchDomainProps): OpenSearchDomainDefaults => {
  validateEnvironmentConfig(props);
  validateLoggingConfig(props);

  const environment = resolveEnvironmentConfig(props);
  const isProduction = isProductionEnvironment(environment);

  return {
    version: OpenSearchVersion.OPENSEARCH_2_19,
    capacity: isProduction ? productionCapacity() : nonProductionCapacity(),
    ebs: defaultEbsOptions(),
    zoneAwareness: isProduction ? productionZoneAwareness() : nonProductionZoneAwareness(),
    logging: defaultLoggingOptions(props),
    logRetention: isProduction ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
    logRemovalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.SNAPSHOT,
  };
};

const createLogGroupResource = (
  resourceProps: OpenSearchLogGroupResourceProps,
  suffix: string,
): LogGroup => {
  const { scope, id, props, defaults } = resourceProps;

  return new LogGroup(scope, `${id}${suffix}LogGroup`, {
    logGroupName: `/aws/opensearch/${props.domainName}/${suffix}`,
    retention: props.logRetention ?? defaults.logRetention,
    removalPolicy: props.logRemovalPolicy ?? defaults.logRemovalPolicy,
  });
};

export const createLogGroupResources = (
  resourceProps: OpenSearchLogGroupResourceProps,
): OpenSearchDomainLogGroups => {
  const { props, defaults } = resourceProps;
  const logging = {
    ...defaults.logging,
    ...props.logging,
  };

  return {
    appLogGroup:
      logging.appLogEnabled === true && logging.appLogGroup === undefined
        ? createLogGroupResource(resourceProps, 'app')
        : logging.appLogGroup,
    slowSearchLogGroup:
      logging.slowSearchLogEnabled === true && logging.slowSearchLogGroup === undefined
        ? createLogGroupResource(resourceProps, 'slow-search')
        : logging.slowSearchLogGroup,
    slowIndexLogGroup:
      logging.slowIndexLogEnabled === true && logging.slowIndexLogGroup === undefined
        ? createLogGroupResource(resourceProps, 'slow-index')
        : logging.slowIndexLogGroup,
    auditLogGroup:
      logging.auditLogEnabled === true && logging.auditLogGroup === undefined
        ? createLogGroupResource(resourceProps, 'audit')
        : logging.auditLogGroup,
  };
};

const createLoggingOptions = (
  props: OpenSearchDomainProps,
  defaults: OpenSearchDomainDefaults,
  logGroups: OpenSearchDomainLogGroups,
): LoggingOptions => {
  const logging = {
    ...defaults.logging,
    ...props.logging,
  };

  return {
    appLogEnabled: logging.appLogEnabled,
    appLogGroup: logging.appLogGroup ?? logGroups.appLogGroup,
    slowSearchLogEnabled: logging.slowSearchLogEnabled,
    slowSearchLogGroup: logging.slowSearchLogGroup ?? logGroups.slowSearchLogGroup,
    slowIndexLogEnabled: logging.slowIndexLogEnabled,
    slowIndexLogGroup: logging.slowIndexLogGroup ?? logGroups.slowIndexLogGroup,
    auditLogEnabled: logging.auditLogEnabled,
    auditLogGroup: logging.auditLogGroup ?? logGroups.auditLogGroup,
  };
};

export const createOpenSearchDomainResource = (
  resourceProps: OpenSearchDomainResourceProps,
): Domain => {
  const { scope, id, props, defaults, logGroups } = resourceProps;
  const environment = resolveEnvironmentConfig(props);
  const domainProps: DomainProps = {
    domainName: props.domainName,
    version: props.version ?? defaults.version,
    vpc: props.vpc,
    vpcSubnets: props.vpcSubnets ? [...props.vpcSubnets] : undefined,
    securityGroups: props.securityGroups ? [...props.securityGroups] : undefined,
    capacity: {
      ...defaults.capacity,
      ...props.capacity,
    },
    ebs: {
      ...defaults.ebs,
      ...props.ebs,
    },
    zoneAwareness: {
      ...defaults.zoneAwareness,
      ...props.zoneAwareness,
    },
    logging: createLoggingOptions(props, defaults, logGroups),
    accessPolicies: props.accessPolicies ? [...props.accessPolicies] : undefined,
    advancedOptions: props.advancedOptions,
    fineGrainedAccessControl: props.fineGrainedAccessControl,
    customEndpoint: props.customEndpoint,
    cognitoDashboardsAuth: props.cognitoDashboardsAuth,
    ipAddressType: props.ipAddressType,
    coldStorageEnabled: props.coldStorageEnabled,
    suppressLogsResourcePolicy: props.suppressLogsResourcePolicy,
    enforceHttps: true,
    tlsSecurityPolicy: TLSSecurityPolicy.TLS_1_2_PFS,
    encryptionAtRest: {
      enabled: true,
    },
    nodeToNodeEncryption: true,
    enableVersionUpgrade: true,
    enableAutoSoftwareUpdate: true,
    offPeakWindowEnabled: true,
    offPeakWindowStart: DEFAULT_OFF_PEAK_START,
    automatedSnapshotStartHour: DEFAULT_SNAPSHOT_START_HOUR,
    removalPolicy: props.removalPolicy ?? defaults.removalPolicy,
    ...props.domainOverrides,
  };
  const domain = new Domain(scope, `${id}Domain`, domainProps);

  applyTags(domain, {
    ...props.tags,
    Environment: environment.name,
  });

  return domain;
};

export const createOpenSearchDomainResources = (
  resourceProps: CreateOpenSearchDomainResourceProps,
): OpenSearchDomainResources => {
  const defaults = defaultsForEnvironment(resourceProps.props);
  const logGroups = createLogGroupResources({
    ...resourceProps,
    defaults,
  });
  const domain = createOpenSearchDomainResource({
    ...resourceProps,
    defaults,
    logGroups,
  });

  return {
    domain,
    ...logGroups,
  };
};

export class OpenSearchDomain extends Construct {
  public readonly domain: Domain;
  public readonly appLogGroup: OpenSearchDomainLogGroups['appLogGroup'];
  public readonly slowSearchLogGroup: OpenSearchDomainLogGroups['slowSearchLogGroup'];
  public readonly slowIndexLogGroup: OpenSearchDomainLogGroups['slowIndexLogGroup'];
  public readonly auditLogGroup: OpenSearchDomainLogGroups['auditLogGroup'];

  public constructor(scope: Construct, id: string, props: OpenSearchDomainProps) {
    super(scope, id);

    const resources = createOpenSearchDomainResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.domain = resources.domain;
    this.appLogGroup = resources.appLogGroup;
    this.slowSearchLogGroup = resources.slowSearchLogGroup;
    this.slowIndexLogGroup = resources.slowIndexLogGroup;
    this.auditLogGroup = resources.auditLogGroup;
  }
}

export const createOpenSearchDomain = (
  scope: Construct,
  id: string,
  props: OpenSearchDomainProps,
): OpenSearchDomainResources => {
  const openSearchDomain = new OpenSearchDomain(scope, id, props);

  return {
    domain: openSearchDomain.domain,
    appLogGroup: openSearchDomain.appLogGroup,
    slowSearchLogGroup: openSearchDomain.slowSearchLogGroup,
    slowIndexLogGroup: openSearchDomain.slowIndexLogGroup,
    auditLogGroup: openSearchDomain.auditLogGroup,
  };
};
