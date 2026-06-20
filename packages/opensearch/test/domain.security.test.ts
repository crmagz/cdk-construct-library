import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AccountPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { IConstruct } from 'constructs';

import { OpenSearchDomain } from '../src/index.js';

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

const secureVpcProps = (stack: Stack) => {
  const vpc = Vpc.fromVpcAttributes(stack, 'ImportedVpc', {
    vpcId: 'vpc-1234567890abcdef0',
    availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    privateSubnetIds: [
      'subnet-11111111111111111',
      'subnet-22222222222222222',
      'subnet-33333333333333333',
    ],
  });
  const securityGroup = SecurityGroup.fromSecurityGroupId(
    stack,
    'ImportedDomainSecurityGroup',
    'sg-1234567890abcdef0',
  );

  return {
    vpc,
    securityGroups: [securityGroup],
    suppressLogsResourcePolicy: true,
    accessPolicies: [
      new PolicyStatement({
        principals: [new AccountPrincipal(prodEnv.account)],
        actions: ['es:ESHttp*'],
        resources: ['*'],
        conditions: {
          IpAddress: {
            'aws:sourceIp': ['10.0.0.0/8'],
          },
        },
      }),
    ],
  };
};

const findConstructByPath = (scope: IConstruct, path: string): IConstruct => {
  const construct = scope.node.findAll().find((child) => child.node.path === path);

  if (construct === undefined) {
    throw new Error(`Expected to find construct at path ${path}.`);
  }

  return construct;
};

const acknowledgeNagRule = (construct: IConstruct, id: string, reason: string): void => {
  construct.node.addMetadata(Validations.ACKNOWLEDGED_RULES_METADATA_KEY, {
    [id]: reason,
  });
};

const acknowledgeOpenSearchAccessPolicyCustomResource = (stack: Stack): void => {
  acknowledgeNagRule(
    findConstructByPath(
      stack,
      'OpenSearchDomainSecurityStack/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
    ),
    'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
    'The CDK OpenSearch L2 creates a singleton custom-resource Lambda for domain access policy updates.',
  );
  acknowledgeNagRule(
    findConstructByPath(
      stack,
      'OpenSearchDomainSecurityStack/AWS679f53fac002430cb0da5b7982bd2287/Resource',
    ),
    'AwsSolutions-L1',
    'The flagged Lambda is the CDK OpenSearch L2 singleton custom resource, not code owned by this construct.',
  );
};

describe('OpenSearchDomain security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'OpenSearchDomainSecurityStack');

    try {
      new OpenSearchDomain(stack, 'Search', {
        env: prodEnv,
        domainName: 'security-search-prod',
        ...secureVpcProps(stack),
      });
      acknowledgeOpenSearchAccessPolicyCustomResource(stack);

      expect(() => app.synth()).not.toThrow();
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });

  it('synthesizes encryption, HTTPS enforcement, and log publishing guardrails', () => {
    const stack = new Stack();

    new OpenSearchDomain(stack, 'Search', {
      env: prodEnv,
      domainName: 'security-search-prod',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::OpenSearchService::Domain', {
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
    });
    template.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 30,
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable guardrails', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureOpenSearchDomainStack');

    try {
      new OpenSearchDomain(stack, 'Search', {
        env: prodEnv,
        domainName: 'insecure-search-prod',
        domainOverrides: {
          enforceHttps: false,
          encryptionAtRest: {
            enabled: false,
          },
          nodeToNodeEncryption: false,
          logging: {
            appLogEnabled: false,
            slowSearchLogEnabled: false,
            slowIndexLogEnabled: false,
          },
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-OS2');
      expect(validationOutput).toContain('AwsSolutions-OS3');
      expect(validationOutput).toContain('AwsSolutions-OS5');
      expect(validationOutput).toContain('AwsSolutions-OS8');
      expect(validationOutput).toContain('AwsSolutions-OS9');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
