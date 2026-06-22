# @cdk-construct/cloudfront

CloudFront distribution constructs for AWS CDK with secure viewer defaults, access logging, and environment-aware edge cost controls.

## Install

```sh
npm install @cdk-construct/cloudfront @cdk-construct/core
```

## Quick Start

```ts
import { Stack } from 'aws-cdk-lib';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { EnvironmentName } from '@cdk-construct/core';
import { CloudFrontDistribution } from '@cdk-construct/cloudfront';

const stack = new Stack();

new CloudFrontDistribution(stack, 'AssetsCdn', {
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  origin: new HttpOrigin('assets.example.com'),
  defaultRootObject: 'index.html',
});
```

## Defaults

- Redirects viewers from HTTP to HTTPS.
- Requires TLS 1.2 2021 or newer for viewer connections.
- Uses HTTP/2 and HTTP/3.
- Enables compression and AWS managed security response headers.
- Enables CloudFront access logging.
- Uses all edge locations in production and `PriceClass_100` outside production.
- Publishes additional CloudWatch metrics in production.

## Documentation

- [Distribution construct](./docs/distribution.md)

## Release Notes

Package release notes follow Conventional Commit categories generated from Changesets summaries.
