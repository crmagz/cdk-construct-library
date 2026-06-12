import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, BucketEncryption, StorageClass } from 'aws-cdk-lib/aws-s3';
import type {
  BucketProps,
  IntelligentTieringConfiguration,
  LifecycleRule,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { BucketEnvironment, StorageCostStrategy } from './enums.js';
import type { S3BucketDefaults, S3BucketProps } from './types.js';

const DEFAULT_INFREQUENT_ACCESS_AFTER = Duration.days(30);
const DEFAULT_ARCHIVE_AFTER = Duration.days(90);
const DEFAULT_DEEP_ARCHIVE_AFTER = Duration.days(180);
const DEFAULT_NONCURRENT_EXPIRATION = Duration.days(30);
const DEFAULT_ABORT_MULTIPART_AFTER = Duration.days(7);

const isProduction = (environment: BucketEnvironment): boolean =>
  environment === BucketEnvironment.PRODUCTION;

const defaultsForEnvironment = (environment: BucketEnvironment): S3BucketDefaults => {
  if (isProduction(environment)) {
    return {
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    };
  }

  return {
    versioned: false,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  };
};

const defaultStorageCostStrategy = (environment: BucketEnvironment): StorageCostStrategy => {
  return isProduction(environment)
    ? StorageCostStrategy.INTELLIGENT_TIERING
    : StorageCostStrategy.INFREQUENT_ACCESS;
};

const baseLifecycleRule = (props: S3BucketProps, versioned: boolean): LifecycleRule => {
  return {
    enabled: true,
    abortIncompleteMultipartUploadAfter:
      props.abortIncompleteMultipartUploadAfter ?? DEFAULT_ABORT_MULTIPART_AFTER,
    noncurrentVersionExpiration: versioned
      ? (props.expireNoncurrentObjectVersionsAfter ?? DEFAULT_NONCURRENT_EXPIRATION)
      : undefined,
  };
};

const createLifecycleRules = (
  strategy: StorageCostStrategy,
  props: S3BucketProps,
  versioned: boolean,
): LifecycleRule[] => {
  const baseRule = baseLifecycleRule(props, versioned);

  switch (strategy) {
    case StorageCostStrategy.NONE:
      return [baseRule];
    case StorageCostStrategy.INFREQUENT_ACCESS:
      return [
        {
          ...baseRule,
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter:
                props.transitionToInfrequentAccessAfter ?? DEFAULT_INFREQUENT_ACCESS_AFTER,
            },
          ],
        },
      ];
    case StorageCostStrategy.ARCHIVE:
      return [
        {
          ...baseRule,
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter:
                props.transitionToInfrequentAccessAfter ?? DEFAULT_INFREQUENT_ACCESS_AFTER,
            },
            {
              storageClass: StorageClass.GLACIER,
              transitionAfter: props.transitionToArchiveAfter ?? DEFAULT_ARCHIVE_AFTER,
            },
          ],
        },
      ];
    case StorageCostStrategy.INTELLIGENT_TIERING:
    case StorageCostStrategy.INTELLIGENT_TIERING_ARCHIVE:
      return [
        {
          ...baseRule,
          transitions: [
            {
              storageClass: StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(0),
            },
          ],
        },
      ];
  }
};

const createIntelligentTieringConfigurations = (
  strategy: StorageCostStrategy,
  props: S3BucketProps,
): IntelligentTieringConfiguration[] | undefined => {
  if (strategy !== StorageCostStrategy.INTELLIGENT_TIERING_ARCHIVE) {
    return undefined;
  }

  return [
    {
      name: 'archive-tiers',
      archiveAccessTierTime: props.intelligentTieringArchiveAccessAfter ?? DEFAULT_ARCHIVE_AFTER,
      deepArchiveAccessTierTime:
        props.intelligentTieringDeepArchiveAccessAfter ?? DEFAULT_DEEP_ARCHIVE_AFTER,
    },
  ];
};

const addResourcePolicies = (
  bucket: Bucket,
  policyStatements: readonly PolicyStatement[] | undefined,
): void => {
  policyStatements?.forEach((policyStatement) => {
    bucket.addToResourcePolicy(policyStatement);
  });
};

export class S3Bucket extends Construct {
  public readonly bucket: Bucket;

  public constructor(scope: Construct, id: string, props: S3BucketProps = {}) {
    super(scope, id);

    const environment = props.environment ?? BucketEnvironment.PRODUCTION;
    const defaults = defaultsForEnvironment(environment);
    const versioned = props.versioned ?? defaults.versioned;
    const storageCostStrategy =
      props.storageCostStrategy ?? defaultStorageCostStrategy(environment);
    const encryptionKey = props.encryptionKeyArn
      ? Key.fromKeyArn(this, 'EncryptionKey', props.encryptionKeyArn)
      : undefined;

    const bucketProps: BucketProps = {
      bucketName: props.bucketName,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: encryptionKey ? BucketEncryption.KMS : BucketEncryption.S3_MANAGED,
      encryptionKey,
      versioned,
      removalPolicy: props.removalPolicy ?? defaults.removalPolicy,
      autoDeleteObjects: props.autoDeleteObjects ?? defaults.autoDeleteObjects,
      cors: props.cors ? [...props.cors] : undefined,
      lifecycleRules: props.lifecycleRules
        ? [...props.lifecycleRules]
        : createLifecycleRules(storageCostStrategy, props, versioned),
      intelligentTieringConfigurations: createIntelligentTieringConfigurations(
        storageCostStrategy,
        props,
      ),
      ...props.bucketOverrides,
    };

    this.bucket = new Bucket(this, 'Resource', bucketProps);
    addResourcePolicies(this.bucket, props.resourcePolicyStatements);
  }
}

export const createS3Bucket = (scope: Construct, id: string, props: S3BucketProps = {}): Bucket => {
  return new S3Bucket(scope, id, props).bucket;
};
