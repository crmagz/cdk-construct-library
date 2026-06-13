import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import {
  AllowedMethods,
  CachedMethods,
  Distribution,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import type { BehaviorOptions, DistributionProps } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

import type {
  CloudFrontDistributionDefaults,
  CloudFrontDistributionProps,
  CloudFrontDistributionResourceProps,
  CloudFrontDistributionResources,
} from './types.js';

const defaultsForEnvironment = (
  props: CloudFrontDistributionProps,
): CloudFrontDistributionDefaults => {
  const environment = resolveEnvironmentConfig(props);
  const production = isProductionEnvironment(environment);

  return {
    enableLogging: true,
    priceClass: production ? PriceClass.PRICE_CLASS_ALL : PriceClass.PRICE_CLASS_100,
    publishAdditionalMetrics: production,
  };
};

const createBehavior = (behavior: BehaviorOptions): BehaviorOptions => {
  return {
    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
    compress: true,
    responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    ...behavior,
  };
};

const createDefaultBehavior = (props: CloudFrontDistributionProps): BehaviorOptions => {
  return createBehavior({
    origin: props.origin,
    ...props.defaultBehaviorOverrides,
  });
};

const createAdditionalBehaviors = (
  additionalBehaviors: Record<string, BehaviorOptions> | undefined,
): Record<string, BehaviorOptions> | undefined => {
  if (!additionalBehaviors) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(additionalBehaviors).map(([pathPattern, behavior]) => [
      pathPattern,
      createBehavior(behavior),
    ]),
  );
};

const createDistributionProps = (
  props: CloudFrontDistributionProps,
  defaults: CloudFrontDistributionDefaults,
): DistributionProps => {
  return {
    additionalBehaviors: createAdditionalBehaviors(props.additionalBehaviors),
    certificate: props.certificate,
    comment: props.comment,
    defaultBehavior: createDefaultBehavior(props),
    defaultRootObject: props.defaultRootObject,
    domainNames: props.domainNames ? [...props.domainNames] : undefined,
    enableIpv6: true,
    enableLogging: props.enableLogging ?? defaults.enableLogging,
    errorResponses: props.errorResponses ? [...props.errorResponses] : undefined,
    geoRestriction: props.geoRestriction,
    httpVersion: HttpVersion.HTTP2_AND_3,
    logBucket: props.logBucket,
    logFilePrefix: props.logFilePrefix,
    logIncludesCookies: props.logIncludesCookies,
    minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
    priceClass: props.priceClass ?? defaults.priceClass,
    publishAdditionalMetrics: props.publishAdditionalMetrics ?? defaults.publishAdditionalMetrics,
    webAclId: props.webAclId,
    ...props.distributionOverrides,
  };
};

export class CloudFrontDistribution extends Construct {
  public readonly distribution: Distribution;

  public constructor(scope: Construct, id: string, props: CloudFrontDistributionProps) {
    super(scope, id);

    const resources = createCloudFrontDistributionResource({
      scope: this,
      id: 'Resource',
      props,
    });

    this.distribution = resources.distribution;
  }
}

export const createCloudFrontDistributionResource = (
  resourceProps: CloudFrontDistributionResourceProps,
): CloudFrontDistributionResources => {
  const { scope, id, props } = resourceProps;
  const defaults = defaultsForEnvironment(props);
  const distribution = new Distribution(scope, `${id}Distribution`, {
    ...createDistributionProps(props, defaults),
  });

  return { distribution };
};

export const createCloudFrontDistribution = (
  scope: Construct,
  id: string,
  props: CloudFrontDistributionProps,
): CloudFrontDistributionResources => {
  const cloudFrontDistribution = new CloudFrontDistribution(scope, id, props);

  return {
    distribution: cloudFrontDistribution.distribution,
  };
};
