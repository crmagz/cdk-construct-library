import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3';

import { BucketEnvironment, S3Bucket, StorageCostStrategy, createS3Bucket } from '../src/index.js';

const synthesizeBucket = (bucket: S3Bucket): Template => {
  return Template.fromStack(Stack.of(bucket));
};

describe('S3Bucket', () => {
  it('creates a production bucket with secure retained defaults', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'LogsBucket', {
      bucketName: 'app-logs-prod',
    });

    const template = synthesizeBucket(bucket);
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'app-logs-prod',
      VersioningConfiguration: {
        Status: 'Enabled',
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: {
        Rules: [
          {
            Status: 'Enabled',
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 7,
            },
            NoncurrentVersionExpiration: {
              NoncurrentDays: 30,
            },
            Transitions: [
              {
                StorageClass: 'INTELLIGENT_TIERING',
                TransitionInDays: 0,
              },
            ],
          },
        ],
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          }),
        ]),
      },
    });
  });

  it('uses non-production cost-saving defaults when requested', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'ArtifactsBucket', {
      bucketName: 'app-artifacts-dev',
      environment: BucketEnvironment.DEVELOPMENT,
    });

    const template = synthesizeBucket(bucket);
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    });
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'app-artifacts-dev',
      VersioningConfiguration: Match.absent(),
      LifecycleConfiguration: {
        Rules: [
          {
            Status: 'Enabled',
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 7,
            },
            Transitions: [
              {
                StorageClass: 'STANDARD_IA',
                TransitionInDays: 30,
              },
            ],
          },
        ],
      },
    });
  });

  it('supports archive tier lifecycle transitions', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'ArchiveBucket', {
      bucketName: 'app-archive-prod',
      storageCostStrategy: StorageCostStrategy.ARCHIVE,
      transitionToInfrequentAccessAfter: Duration.days(45),
      transitionToArchiveAfter: Duration.days(120),
    });

    const template = synthesizeBucket(bucket);
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            Transitions: [
              {
                StorageClass: 'STANDARD_IA',
                TransitionInDays: 45,
              },
              {
                StorageClass: 'GLACIER',
                TransitionInDays: 120,
              },
            ],
          }),
        ],
      },
    });
  });

  it('supports intelligent tiering archive tiers', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'TieredBucket', {
      storageCostStrategy: StorageCostStrategy.INTELLIGENT_TIERING_ARCHIVE,
      intelligentTieringArchiveAccessAfter: Duration.days(90),
      intelligentTieringDeepArchiveAccessAfter: Duration.days(365),
    });

    const template = synthesizeBucket(bucket);
    template.hasResourceProperties('AWS::S3::Bucket', {
      IntelligentTieringConfigurations: [
        {
          Id: 'archive-tiers',
          Status: 'Enabled',
          Tierings: [
            {
              AccessTier: 'ARCHIVE_ACCESS',
              Days: 90,
            },
            {
              AccessTier: 'DEEP_ARCHIVE_ACCESS',
              Days: 365,
            },
          ],
        },
      ],
    });
  });

  it('supports KMS encryption and CORS rules', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'WebBucket', {
      encryptionKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/example',
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.HEAD],
          allowedOrigins: ['https://example.com'],
          allowedHeaders: ['*'],
        },
      ],
    });

    const template = synthesizeBucket(bucket);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
              KMSMasterKeyID: Match.anyValue(),
            },
          },
        ],
      },
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: ['https://example.com'],
          },
        ],
      },
    });
  });

  it('attaches resource policy statements', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'SharedBucket', {
      bucketName: 'shared-data-prod',
      resourcePolicyStatements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          principals: [new AccountPrincipal('123456789012')],
          actions: ['s3:GetObject'],
          resources: ['arn:aws:s3:::shared-data-prod/*'],
        }),
      ],
    });

    const template = synthesizeBucket(bucket);
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: 's3:GetObject',
            Resource: 'arn:aws:s3:::shared-data-prod/*',
          }),
        ]),
      },
    });
  });

  it('allows explicit CDK bucket overrides', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'OverrideBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      bucketOverrides: {
        versioned: false,
      },
    });

    const template = synthesizeBucket(bucket);
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: Match.absent(),
    });
  });
});

describe('createS3Bucket', () => {
  it('returns the underlying bucket construct', () => {
    const stack = new Stack();
    const bucket = createS3Bucket(stack, 'Bucket');

    expect(bucket).toBeInstanceOf(Bucket);
  });
});
