import { EnvironmentName } from '@cdk-construct/core';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { EbsDeviceVolumeType } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Domain, EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';

import {
  OpenSearchDomain,
  OpenSearchVersion,
  createLogGroupResources,
  createOpenSearchDomain,
  createOpenSearchDomainResource,
  defaultsForEnvironment,
} from '../src/index.js';
import type { OpenSearchDomainProps } from '../src/index.js';

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

const defaultProps = (props: Partial<OpenSearchDomainProps> = {}): OpenSearchDomainProps => {
  return {
    env: prodEnv,
    domainName: 'search-prod',
    ...props,
  };
};

const synthesizeDomain = (domain: OpenSearchDomain): Template => {
  return Template.fromStack(Stack.of(domain));
};

describe('OpenSearchDomain', () => {
  it('creates a production domain with secure multi-AZ defaults', () => {
    const stack = new Stack();
    const domain = new OpenSearchDomain(stack, 'Search', defaultProps());

    const template = synthesizeDomain(domain);
    template.resourceCountIs('AWS::OpenSearchService::Domain', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 3);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      DomainName: 'search-prod',
      EngineVersion: 'OpenSearch_2.19',
      ClusterConfig: Match.objectLike({
        DedicatedMasterEnabled: true,
        DedicatedMasterCount: 3,
        DedicatedMasterType: 'r7g.large.search',
        InstanceCount: 3,
        InstanceType: 'r7g.large.search',
        MultiAZWithStandbyEnabled: true,
        ZoneAwarenessEnabled: true,
        ZoneAwarenessConfig: {
          AvailabilityZoneCount: 3,
        },
      }),
      EBSOptions: Match.objectLike({
        EBSEnabled: true,
        VolumeSize: 100,
        VolumeType: 'gp3',
      }),
      DomainEndpointOptions: Match.objectLike({
        EnforceHTTPS: true,
        TLSSecurityPolicy: 'Policy-Min-TLS-1-2-PFS-2023-10',
      }),
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      SoftwareUpdateOptions: {
        AutoSoftwareUpdateEnabled: true,
      },
      LogPublishingOptions: Match.objectLike({
        ES_APPLICATION_LOGS: Match.objectLike({
          Enabled: true,
        }),
        SEARCH_SLOW_LOGS: Match.objectLike({
          Enabled: true,
        }),
        INDEX_SLOW_LOGS: Match.objectLike({
          Enabled: true,
        }),
      }),
      Tags: Match.arrayWith([
        {
          Key: 'Environment',
          Value: EnvironmentName.PROD,
        },
      ]),
    });
  });

  it('uses smaller non-production capacity and lifecycle defaults', () => {
    const stack = new Stack();
    const domain = new OpenSearchDomain(
      stack,
      'Search',
      defaultProps({
        env: devEnv,
        domainName: 'search-dev',
      }),
    );

    const template = synthesizeDomain(domain);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      DomainName: 'search-dev',
      ClusterConfig: Match.objectLike({
        DedicatedMasterEnabled: false,
        InstanceCount: 1,
        InstanceType: 'r7g.large.search',
        MultiAZWithStandbyEnabled: false,
        ZoneAwarenessEnabled: false,
      }),
    });
    template.hasResource('AWS::OpenSearchService::Domain', {
      DeletionPolicy: 'Snapshot',
    });
    template.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });
  });

  it('allows direct capacity, EBS, logging, and removal policy configuration', () => {
    const stack = new Stack();
    const domain = new OpenSearchDomain(
      stack,
      'Search',
      defaultProps({
        domainName: 'search-configured',
        version: OpenSearchVersion.OPENSEARCH_3_1,
        capacity: {
          masterNodes: 3,
          masterNodeInstanceType: 'm7g.large.search',
          dataNodes: 6,
          dataNodeInstanceType: 'r7g.xlarge.search',
        },
        ebs: {
          volumeSize: 250,
          volumeType: EbsDeviceVolumeType.GP3,
          iops: 3000,
          throughput: 125,
        },
        logging: {
          appLogEnabled: true,
          slowSearchLogEnabled: false,
          slowIndexLogEnabled: false,
        },
        logRetention: RetentionDays.THREE_MONTHS,
        removalPolicy: RemovalPolicy.RETAIN,
      }),
    );

    const template = synthesizeDomain(domain);
    template.resourceCountIs('AWS::Logs::LogGroup', 1);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      EngineVersion: 'OpenSearch_3.1',
      ClusterConfig: Match.objectLike({
        DedicatedMasterEnabled: true,
        DedicatedMasterCount: 3,
        DedicatedMasterType: 'm7g.large.search',
        InstanceCount: 6,
        InstanceType: 'r7g.xlarge.search',
      }),
      EBSOptions: Match.objectLike({
        VolumeSize: 250,
        VolumeType: 'gp3',
        Iops: 3000,
        Throughput: 125,
      }),
      LogPublishingOptions: Match.objectLike({
        ES_APPLICATION_LOGS: Match.objectLike({
          Enabled: true,
        }),
        SEARCH_SLOW_LOGS: Match.objectLike({
          Enabled: false,
        }),
        INDEX_SLOW_LOGS: Match.objectLike({
          Enabled: false,
        }),
      }),
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 90,
    });
  });

  it('creates audit log groups only when audit logging and fine-grained access control are enabled', () => {
    const stack = new Stack();
    const domain = new OpenSearchDomain(
      stack,
      'Search',
      defaultProps({
        logging: {
          auditLogEnabled: true,
        },
        fineGrainedAccessControl: {
          masterUserName: 'admin',
        },
      }),
    );

    const template = synthesizeDomain(domain);
    template.resourceCountIs('AWS::Logs::LogGroup', 4);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      LogPublishingOptions: Match.objectLike({
        AUDIT_LOGS: Match.objectLike({
          Enabled: true,
        }),
      }),
    });
  });

  it('allows direct CDK domain overrides as an escape hatch', () => {
    const stack = new Stack();
    const domain = new OpenSearchDomain(
      stack,
      'Search',
      defaultProps({
        domainName: 'search-override',
        domainOverrides: {
          enforceHttps: false,
          tlsSecurityPolicy: undefined,
          enableAutoSoftwareUpdate: false,
        },
      }),
    );

    const template = synthesizeDomain(domain);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
      DomainName: 'search-override',
      DomainEndpointOptions: Match.objectLike({
        EnforceHTTPS: false,
      }),
      SoftwareUpdateOptions: {
        AutoSoftwareUpdateEnabled: false,
      },
    });
  });

  it('throws when environment config is omitted', () => {
    const stack = new Stack();

    expect(() => {
      new OpenSearchDomain(stack, 'Search', {
        domainName: 'search-missing-env',
      } as OpenSearchDomainProps);
    }).toThrow('Environment config is required');
  });

  it('throws when audit logging is enabled without fine-grained access control', () => {
    const stack = new Stack();

    expect(() => {
      new OpenSearchDomain(
        stack,
        'Search',
        defaultProps({
          logging: {
            auditLogEnabled: true,
          },
        }),
      );
    }).toThrow('OpenSearch audit logging requires fineGrainedAccessControl');
  });
});

describe('createOpenSearchDomain', () => {
  it('returns the domain resources', () => {
    const stack = new Stack();
    const resources = createOpenSearchDomain(stack, 'Search', defaultProps());

    expect(resources.domain).toBeInstanceOf(Domain);
    expect(resources.appLogGroup).toBeDefined();
    expect(resources.slowSearchLogGroup).toBeDefined();
    expect(resources.slowIndexLogGroup).toBeDefined();
    expect(resources.auditLogGroup).toBeUndefined();
  });
});

describe('resource creators', () => {
  it('creates resources from typed resource props', () => {
    const stack = new Stack();
    const props = defaultProps({ domainName: 'search-resource' });
    const defaults = defaultsForEnvironment(props);
    const logGroups = createLogGroupResources({
      scope: stack,
      id: 'Search',
      props,
      defaults,
    });
    const domain = createOpenSearchDomainResource({
      scope: stack,
      id: 'Search',
      props,
      defaults,
      logGroups,
    });

    expect(defaults.version).toBe(EngineVersion.OPENSEARCH_2_19);
    expect(domain).toBeInstanceOf(Domain);
    expect(logGroups.appLogGroup).toBeDefined();
  });
});
