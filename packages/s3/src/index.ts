export { EnvironmentName } from '@cdk-construct/core';
export type {
  AwsAccountId,
  AwsRegion,
  DeploymentEnvironment,
  EnvironmentAwareProps,
  EnvironmentConfig,
  EnvironmentInput,
  EnvironmentNameLike,
} from '@cdk-construct/core';
export { BucketEnvironment, StorageCostStrategy } from './enums.js';
export { S3Bucket, createS3Bucket } from './bucket.js';
export type { S3BucketDefaults, S3BucketProps } from './types.js';
