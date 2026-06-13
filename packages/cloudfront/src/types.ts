import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type {
  BehaviorOptions,
  Distribution,
  DistributionProps,
  PriceClass,
} from 'aws-cdk-lib/aws-cloudfront';
import type { Construct } from 'constructs';

export type CloudFrontDistributionBehaviorOverrides = Omit<BehaviorOptions, 'origin'>;

export type CloudFrontDistributionOverrides = Omit<
  DistributionProps,
  'defaultBehavior' | 'additionalBehaviors'
>;

export type CloudFrontDistributionProps = EnvironmentAwareProps & {
  readonly origin: BehaviorOptions['origin'];
  readonly additionalBehaviors?: Record<string, BehaviorOptions>;
  readonly certificate?: DistributionProps['certificate'];
  readonly comment?: string;
  readonly defaultRootObject?: string;
  readonly domainNames?: readonly string[];
  readonly enableLogging?: boolean;
  readonly errorResponses?: DistributionProps['errorResponses'];
  readonly geoRestriction?: DistributionProps['geoRestriction'];
  readonly logBucket?: DistributionProps['logBucket'];
  readonly logFilePrefix?: string;
  readonly logIncludesCookies?: boolean;
  readonly priceClass?: PriceClass;
  readonly publishAdditionalMetrics?: boolean;
  readonly webAclId?: string;
  readonly defaultBehaviorOverrides?: CdkOverrides<CloudFrontDistributionBehaviorOverrides>;
  readonly distributionOverrides?: CdkOverrides<CloudFrontDistributionOverrides>;
};

export type CloudFrontDistributionDefaults = {
  readonly enableLogging: boolean;
  readonly priceClass: PriceClass;
  readonly publishAdditionalMetrics: boolean;
};

export type CloudFrontDistributionResources = {
  readonly distribution: Distribution;
};

export type CloudFrontDistributionResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: CloudFrontDistributionProps;
};
