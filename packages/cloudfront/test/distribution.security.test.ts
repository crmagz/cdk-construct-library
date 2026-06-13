import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { DistributionProps } from 'aws-cdk-lib/aws-cloudfront';
import {
  GeoRestriction,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { AwsSolutionsChecks } from 'cdk-nag';

import { CloudFrontDistribution } from '../src/index.js';

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

const createCertificate = (stack: Stack): DistributionProps['certificate'] => {
  return Certificate.fromCertificateArn(
    stack,
    'Certificate',
    'arn:aws:acm:us-east-1:123456789012:certificate/example',
  );
};

const createLogBucket = (stack: Stack): Bucket => {
  const bucket = new Bucket(stack, 'CloudFrontAccessLogs', {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: ObjectOwnership.OBJECT_WRITER,
  });

  const bucketResource = bucket.node.defaultChild;

  if (!bucketResource) {
    throw new Error('CloudFront access log bucket resource was not created.');
  }

  Validations.of(bucketResource).acknowledge({
    id: 'AwsSolutions-S1',
    reason:
      'This bucket receives CloudFront access logs; logging this bucket would create recursive log delivery.',
  });

  return bucket;
};

describe('CloudFrontDistribution security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'CloudFrontDistributionSecurityStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });

    new CloudFrontDistribution(stack, 'Assets', {
      env: prodEnv,
      origin: new HttpOrigin('assets.example.com'),
      certificate: createCertificate(stack),
      domainNames: ['cdn.example.com'],
      geoRestriction: GeoRestriction.allowlist('US', 'CA'),
      logBucket: createLogBucket(stack),
      webAclId:
        'arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/00000000-0000-0000-0000-000000000000',
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('synthesizes HTTPS, TLS, logging, and security header guardrails', () => {
    const stack = new Stack(undefined, 'CloudFrontGuardrailStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });

    new CloudFrontDistribution(stack, 'Assets', {
      env: prodEnv,
      origin: new HttpOrigin('assets.example.com'),
      certificate: createCertificate(stack),
      domainNames: ['cdn.example.com'],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Logging: Match.anyValue(),
        DefaultCacheBehavior: Match.objectLike({
          ResponseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
        }),
      }),
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable guardrails', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureCloudFrontDistributionStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });

    try {
      new CloudFrontDistribution(stack, 'Assets', {
        env: prodEnv,
        origin: new HttpOrigin('assets.example.com'),
        certificate: createCertificate(stack),
        domainNames: ['cdn.example.com'],
        defaultBehaviorOverrides: {
          viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
        },
        distributionOverrides: {
          enableLogging: false,
          minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1,
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-CFR3');
      expect(validationOutput).toContain('AwsSolutions-CFR4');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
