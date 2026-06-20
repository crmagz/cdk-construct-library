import type { CdkOverrides, EnvironmentAwareProps, TagMap } from '@cdk-construct/core';
import type { RemovalPolicy } from 'aws-cdk-lib';
import type { ISecurityGroup, IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import type { ILogGroupRef } from 'aws-cdk-lib/aws-logs';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';
import type {
  CapacityConfig,
  Domain,
  DomainProps,
  EbsOptions,
  EngineVersion,
  LoggingOptions,
  ZoneAwarenessConfig,
} from 'aws-cdk-lib/aws-opensearchservice';
import type { Construct } from 'constructs';

export type OpenSearchDomainProps = EnvironmentAwareProps & {
  readonly domainName: string;
  readonly version?: EngineVersion;
  readonly vpc?: IVpc;
  readonly vpcSubnets?: readonly SubnetSelection[];
  readonly securityGroups?: readonly ISecurityGroup[];
  readonly capacity?: CapacityConfig;
  readonly ebs?: EbsOptions;
  readonly zoneAwareness?: ZoneAwarenessConfig;
  readonly logging?: LoggingOptions;
  readonly logRetention?: RetentionDays;
  readonly logRemovalPolicy?: RemovalPolicy;
  readonly accessPolicies?: DomainProps['accessPolicies'];
  readonly advancedOptions?: DomainProps['advancedOptions'];
  readonly fineGrainedAccessControl?: DomainProps['fineGrainedAccessControl'];
  readonly customEndpoint?: DomainProps['customEndpoint'];
  readonly cognitoDashboardsAuth?: DomainProps['cognitoDashboardsAuth'];
  readonly ipAddressType?: DomainProps['ipAddressType'];
  readonly coldStorageEnabled?: boolean;
  readonly suppressLogsResourcePolicy?: boolean;
  readonly removalPolicy?: RemovalPolicy;
  readonly tags?: TagMap;
  readonly domainOverrides?: CdkOverrides<DomainProps>;
};

export type OpenSearchDomainDefaults = {
  readonly version: EngineVersion;
  readonly capacity: CapacityConfig;
  readonly ebs: EbsOptions;
  readonly zoneAwareness: ZoneAwarenessConfig;
  readonly logging: LoggingOptions;
  readonly logRetention: RetentionDays;
  readonly logRemovalPolicy: RemovalPolicy;
  readonly removalPolicy: RemovalPolicy;
};

export type OpenSearchDomainLogGroups = {
  readonly appLogGroup?: ILogGroupRef;
  readonly slowSearchLogGroup?: ILogGroupRef;
  readonly slowIndexLogGroup?: ILogGroupRef;
  readonly auditLogGroup?: ILogGroupRef;
};

export type OpenSearchDomainResources = OpenSearchDomainLogGroups & {
  readonly domain: Domain;
};

export type OpenSearchDomainResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: OpenSearchDomainProps;
  readonly defaults: OpenSearchDomainDefaults;
  readonly logGroups: OpenSearchDomainLogGroups;
};

export type OpenSearchLogGroupResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: OpenSearchDomainProps;
  readonly defaults: OpenSearchDomainDefaults;
};

export type CreateOpenSearchDomainResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: OpenSearchDomainProps;
};
