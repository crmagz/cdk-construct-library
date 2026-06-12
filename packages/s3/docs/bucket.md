# S3 Bucket

`S3Bucket` creates an S3 bucket with secure defaults and cost-aware lifecycle configuration.

## Usage

Keep environment-specific construct props in a config file and pass the selected
props through the stack. The stack stays small and creates the bucket once.

`bin/environments.ts`

```ts
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { StorageCostStrategy, type S3BucketProps } from '@cdk-construct/s3';

type StorageEnvironment = EnvironmentConfig & {
  readonly s3: Omit<S3BucketProps, 'env'>;
};

export const environments: StorageEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    s3: {
      bucketName: 'app-assets-dev',
      storageCostStrategy: StorageCostStrategy.INFREQUENT_ACCESS,
      transitionToInfrequentAccessAfter: Duration.days(14),
    },
  },
  {
    env: {
      name: EnvironmentName.STAGING,
      account: '222222222222',
      region: 'us-east-1',
    },
    s3: {
      bucketName: 'app-assets-staging',
      storageCostStrategy: StorageCostStrategy.INTELLIGENT_TIERING,
      expireNoncurrentObjectVersionsAfter: Duration.days(14),
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    s3: {
      bucketName: 'app-assets-prod',
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      storageCostStrategy: StorageCostStrategy.INTELLIGENT_TIERING_ARCHIVE,
      intelligentTieringArchiveAccessAfter: Duration.days(90),
      intelligentTieringDeepArchiveAccessAfter: Duration.days(180),
    },
  },
];
```

`src/storage-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { S3Bucket, type S3BucketProps } from '@cdk-construct/s3';

type StorageStackProps = StackProps &
  EnvironmentConfig & {
    readonly s3: Omit<S3BucketProps, 'env'>;
  };

export class StorageStack extends Stack {
  public constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new S3Bucket(this, 'Assets', {
      env: props.env,
      ...props.s3,
    });
  }
}
```

`bin/app.ts`

```ts
import { App } from 'aws-cdk-lib';
import { environments } from './environments.js';
import { StorageStack } from '../src/storage-stack.js';

const app = new App();

environments.forEach((environment) => {
  new StorageStack(app, `storage-${environment.env.name}`, environment);
});
```

## Environment Defaults

`env` is required so environment-aware defaults are intentional at the stack boundary.

| Environment | Versioning | Removal policy | Auto-delete objects | Storage cost strategy |
| --- | --- | --- | --- | --- |
| `EnvironmentName.PROD` | Enabled | Retain | Disabled | Intelligent tiering |
| `EnvironmentName.STAGING` | Disabled | Destroy | Enabled | Infrequent access |
| `EnvironmentName.DEV` | Disabled | Destroy | Enabled | Infrequent access |

Override any default explicitly when a workload needs different behavior.

## Storage Cost Strategies

`StorageCostStrategy.NONE` keeps only baseline lifecycle hygiene for incomplete multipart uploads and noncurrent versions.

`StorageCostStrategy.INFREQUENT_ACCESS` transitions current objects to Standard-IA after 30 days by default.

`StorageCostStrategy.INTELLIGENT_TIERING` immediately transitions current objects to Intelligent-Tiering.

`StorageCostStrategy.INTELLIGENT_TIERING_ARCHIVE` uses Intelligent-Tiering and configures archive tiers.

`StorageCostStrategy.ARCHIVE` transitions current objects to Standard-IA and then Glacier.

## Escape Hatch

Use `bucketOverrides` for CDK `BucketProps` not modeled directly by this package.

```ts
new S3Bucket(this, 'Events', {
  env: props.env,
  bucketOverrides: {
    eventBridgeEnabled: true,
  },
});
```

## KMS Encryption

```ts
new S3Bucket(this, 'SensitiveData', {
  env: props.env,
  encryptionKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/example',
});
```

## CORS

```ts
import { HttpMethods } from 'aws-cdk-lib/aws-s3';

new S3Bucket(this, 'WebAssets', {
  env: props.env,
  cors: [
    {
      allowedMethods: [HttpMethods.GET, HttpMethods.HEAD],
      allowedOrigins: ['https://example.com'],
      allowedHeaders: ['*'],
    },
  ],
});
```
