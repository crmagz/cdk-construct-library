# @cdk-construct/s3

S3 bucket constructs for AWS CDK with secure defaults, environment-aware retention, and cost-aware storage transitions.

## Install

```sh
npm install @cdk-construct/s3 @cdk-construct/core
```

## Quick Start

```ts
import { Stack } from 'aws-cdk-lib';
import { EnvironmentName } from '@cdk-construct/core';
import { S3Bucket } from '@cdk-construct/s3';

const stack = new Stack();

new S3Bucket(stack, 'Assets', {
  bucketName: 'my-assets-prod',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});
```

## Defaults

- Blocks all public access.
- Enforces SSL.
- Uses S3-managed encryption unless a KMS key ARN is provided.
- Retains and versions production buckets.
- Destroys and auto-deletes non-production buckets by default.
- Applies lifecycle rules for incomplete multipart uploads and storage cost optimization.

## Documentation

- [Bucket construct](./docs/bucket.md)
