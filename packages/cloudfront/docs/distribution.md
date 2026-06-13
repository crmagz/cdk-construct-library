# CloudFront Distribution

`CloudFrontDistribution` creates a CloudFront distribution around a caller-provided origin with secure default cache behavior and environment-aware cost controls.

## Usage

Keep environment-specific construct props in a config file and pass the selected props through the stack. The stack stays small and creates the distribution once.

`bin/environments.ts`

```ts
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import type { CloudFrontDistributionProps } from '@cdk-construct/cloudfront';

type CdnEnvironment = EnvironmentConfig & {
  readonly cloudfront: Omit<CloudFrontDistributionProps, 'env' | 'origin'>;
};

export const environments: CdnEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    cloudfront: {
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_100,
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    cloudfront: {
      defaultRootObject: 'index.html',
      logFilePrefix: 'assets/',
    },
  },
];
```

`src/cdn-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import {
  CloudFrontDistribution,
  type CloudFrontDistributionProps,
} from '@cdk-construct/cloudfront';

type CdnStackProps = StackProps &
  EnvironmentConfig & {
    readonly cloudfront: Omit<CloudFrontDistributionProps, 'env' | 'origin'>;
  };

export class CdnStack extends Stack {
  public constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new CloudFrontDistribution(this, 'AssetsCdn', {
      env: props.env,
      origin: new HttpOrigin('assets.example.com'),
      ...props.cloudfront,
    });
  }
}
```

`bin/app.ts`

```ts
import { App } from 'aws-cdk-lib';
import { environments } from './environments.js';
import { CdnStack } from '../src/cdn-stack.js';

const app = new App();

environments.forEach((environment) => {
  new CdnStack(app, `cdn-${environment.env.name}`, environment);
});
```

## Environment Defaults

`env` is required so environment-aware defaults are intentional at the stack boundary.

| Environment               | Price class        | Access logging | Additional metrics |
| ------------------------- | ------------------ | -------------- | ------------------ |
| `EnvironmentName.PROD`    | All edge locations | Enabled        | Enabled            |
| `EnvironmentName.STAGING` | `PriceClass_100`   | Enabled        | Disabled           |
| `EnvironmentName.DEV`     | `PriceClass_100`   | Enabled        | Disabled           |

Override any default explicitly when a workload needs different behavior.

## Security Defaults

The default behavior redirects HTTP viewers to HTTPS, enables compression, allows `GET`, `HEAD`, and `OPTIONS`, caches the same methods, and attaches the AWS managed security response headers policy.

The distribution uses TLS 1.2 2021 for viewer connections and enables HTTP/2 plus HTTP/3.

CloudFront access logging is enabled by default. Provide `logBucket` when you need to control bucket ownership, retention, or cross-account delivery.

## Custom Domains

```ts
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { GeoRestriction } from 'aws-cdk-lib/aws-cloudfront';

new CloudFrontDistribution(this, 'SiteCdn', {
  env: props.env,
  origin: props.origin,
  certificate: Certificate.fromCertificateArn(
    this,
    'Certificate',
    'arn:aws:acm:us-east-1:123456789012:certificate/example',
  ),
  domainNames: ['cdn.example.com'],
  geoRestriction: GeoRestriction.allowlist('US', 'CA'),
  webAclId:
    'arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/00000000-0000-0000-0000-000000000000',
});
```

## Additional Behaviors

Additional behaviors inherit the same HTTPS redirect, compression, and security response headers unless you override them on that behavior.

```ts
import { CachePolicy } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

new CloudFrontDistribution(this, 'ApiCdn', {
  env: props.env,
  origin: new HttpOrigin('assets.example.com'),
  additionalBehaviors: {
    '/api/*': {
      origin: new HttpOrigin('api.example.com'),
      cachePolicy: CachePolicy.CACHING_DISABLED,
    },
  },
});
```

## Escape Hatch

Use `defaultBehaviorOverrides` and `distributionOverrides` for CDK settings not modeled directly by this package.

```ts
import { PriceClass } from 'aws-cdk-lib/aws-cloudfront';

new CloudFrontDistribution(this, 'RegionalCdn', {
  env: props.env,
  origin: props.origin,
  distributionOverrides: {
    priceClass: PriceClass.PRICE_CLASS_200,
  },
});
```
