import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  CachePolicy,
  Distribution,
  GeoRestriction,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

import {
  CloudFrontDistribution,
  createCloudFrontDistribution,
  createCloudFrontDistributionResource,
} from '../src/index.js';
import type { CloudFrontDistributionProps } from '../src/index.js';

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

const synthesizeDistribution = (distribution: CloudFrontDistribution): Template => {
  return Template.fromStack(Stack.of(distribution));
};

const defaultProps = (
  props: Partial<CloudFrontDistributionProps> = {},
): CloudFrontDistributionProps => {
  return {
    env: prodEnv,
    origin: new HttpOrigin('assets.example.com'),
    ...props,
  };
};

describe('CloudFrontDistribution', () => {
  it('creates a production distribution with secure CDN defaults', () => {
    const stack = new Stack();
    const distribution = new CloudFrontDistribution(
      stack,
      'AssetsDistribution',
      defaultProps({
        defaultRootObject: 'index.html',
        logFilePrefix: 'assets/',
      }),
    );

    const template = synthesizeDistribution(distribution);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::CloudFront::MonitoringSubscription', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        Enabled: true,
        HttpVersion: 'http2and3',
        IPV6Enabled: true,
        PriceClass: 'PriceClass_All',
        Logging: Match.objectLike({
          Prefix: 'assets/',
        }),
        DefaultCacheBehavior: Match.objectLike({
          AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
          CachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          Compress: true,
          ResponseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        Origins: [
          Match.objectLike({
            DomainName: 'assets.example.com',
            CustomOriginConfig: Match.objectLike({
              OriginProtocolPolicy: 'https-only',
              OriginSSLProtocols: ['TLSv1.2'],
            }),
          }),
        ],
      }),
    });
  });

  it('uses cost-aware non-production defaults', () => {
    const stack = new Stack();
    const distribution = new CloudFrontDistribution(
      stack,
      'DevDistribution',
      defaultProps({
        env: devEnv,
      }),
    );

    const template = synthesizeDistribution(distribution);
    template.resourceCountIs('AWS::CloudFront::MonitoringSubscription', 0);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        PriceClass: 'PriceClass_100',
        Logging: Match.anyValue(),
      }),
    });
  });

  it('supports custom domains, WAF, geo restrictions, and additional behaviors', () => {
    const stack = new Stack(undefined, 'CloudFrontStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    const certificate = Certificate.fromCertificateArn(
      stack,
      'Certificate',
      'arn:aws:acm:us-east-1:123456789012:certificate/example',
    );
    const distribution = new CloudFrontDistribution(
      stack,
      'ApiDistribution',
      defaultProps({
        certificate,
        domainNames: ['cdn.example.com'],
        geoRestriction: GeoRestriction.allowlist('US', 'CA'),
        webAclId:
          'arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/00000000-0000-0000-0000-000000000000',
        additionalBehaviors: {
          '/api/*': {
            origin: new HttpOrigin('api.example.com'),
            cachePolicy: CachePolicy.CACHING_DISABLED,
          },
        },
      }),
    );

    const template = synthesizeDistribution(distribution);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['cdn.example.com'],
        WebACLId:
          'arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/00000000-0000-0000-0000-000000000000',
        Restrictions: {
          GeoRestriction: {
            Locations: ['US', 'CA'],
            RestrictionType: 'whitelist',
          },
        },
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/api/*',
            ResponseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        ],
        ViewerCertificate: Match.objectLike({
          AcmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/example',
          MinimumProtocolVersion: 'TLSv1.2_2021',
          SslSupportMethod: 'sni-only',
        }),
      }),
    });
  });

  it('allows explicit CDK distribution and behavior overrides', () => {
    const stack = new Stack();
    const distribution = new CloudFrontDistribution(
      stack,
      'OverrideDistribution',
      defaultProps({
        defaultBehaviorOverrides: {
          viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
        },
        distributionOverrides: {
          enableLogging: false,
          priceClass: PriceClass.PRICE_CLASS_200,
        },
      }),
    );

    const template = synthesizeDistribution(distribution);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Logging: Match.absent(),
        PriceClass: 'PriceClass_200',
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'allow-all',
        }),
      }),
    });
  });
});

describe('createCloudFrontDistribution', () => {
  it('returns the distribution resource', () => {
    const stack = new Stack();
    const resources = createCloudFrontDistribution(stack, 'Assets', defaultProps());

    expect(resources.distribution).toBeInstanceOf(Distribution);
  });
});

describe('resource creators', () => {
  it('creates a distribution from typed resource props', () => {
    const stack = new Stack();
    const resources = createCloudFrontDistributionResource({
      scope: stack,
      id: 'Assets',
      props: defaultProps(),
    });

    expect(resources.distribution).toBeInstanceOf(Distribution);
    Template.fromStack(stack).resourceCountIs('AWS::CloudFront::Distribution', 1);
  });
});
