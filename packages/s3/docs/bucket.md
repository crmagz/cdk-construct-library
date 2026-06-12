# S3 Bucket

`S3Bucket` creates an S3 bucket with secure defaults and cost-aware lifecycle configuration.

## Environment Defaults

Production is the default when `environment` is omitted.

| Environment | Versioning | Removal policy | Auto-delete objects | Storage cost strategy |
| --- | --- | --- | --- | --- |
| `PRODUCTION` | Enabled | Retain | Disabled | Intelligent tiering |
| `STAGING` | Disabled | Destroy | Enabled | Infrequent access |
| `DEVELOPMENT` | Disabled | Destroy | Enabled | Infrequent access |

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
  bucketOverrides: {
    eventBridgeEnabled: true,
  },
});
```

## KMS Encryption

```ts
new S3Bucket(this, 'SensitiveData', {
  encryptionKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/example',
});
```

## CORS

```ts
import { HttpMethods } from 'aws-cdk-lib/aws-s3';

new S3Bucket(this, 'WebAssets', {
  cors: [
    {
      allowedMethods: [HttpMethods.GET, HttpMethods.HEAD],
      allowedOrigins: ['https://example.com'],
      allowedHeaders: ['*'],
    },
  ],
});
```
