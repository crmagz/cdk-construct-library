import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { BucketProps, CorsRule, LifecycleRule } from 'aws-cdk-lib/aws-s3';

import { BucketEnvironment, StorageCostStrategy } from './enums.js';

export interface S3BucketProps {
  readonly bucketName?: string;
  readonly environment?: BucketEnvironment;
  readonly versioned?: boolean;
  readonly removalPolicy?: RemovalPolicy;
  readonly autoDeleteObjects?: boolean;
  readonly storageCostStrategy?: StorageCostStrategy;
  readonly transitionToInfrequentAccessAfter?: Duration;
  readonly transitionToArchiveAfter?: Duration;
  readonly expireNoncurrentObjectVersionsAfter?: Duration;
  readonly abortIncompleteMultipartUploadAfter?: Duration;
  readonly intelligentTieringArchiveAccessAfter?: Duration;
  readonly intelligentTieringDeepArchiveAccessAfter?: Duration;
  readonly encryptionKeyArn?: string;
  readonly cors?: readonly CorsRule[];
  readonly lifecycleRules?: readonly LifecycleRule[];
  readonly resourcePolicyStatements?: readonly PolicyStatement[];
  readonly bucketOverrides?: Partial<BucketProps>;
}

export interface S3BucketDefaults {
  readonly versioned: boolean;
  readonly removalPolicy: RemovalPolicy;
  readonly autoDeleteObjects: boolean;
}
