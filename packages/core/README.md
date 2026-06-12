# @cdk-construct/core

Core utilities and shared types for paved-road AWS CDK constructs.

This package is the first workspace package in the `@cdk-construct` monorepo.
It establishes the shared foundation for constructs that favor safe defaults,
environment-aware configuration, and explicit escape hatches for advanced use.

## Install

```sh
npm install @cdk-construct/core
```

## Status

This package provides shared types and small helpers used by service packages.
It keeps environment names, environment config, tags, and CDK override patterns
consistent across the `@cdk-construct` package family.

## Environment Config

```ts
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';

const environment: EnvironmentConfig = {
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
};
```

Use the provided environment names for standard cases, or pass a string when a
project needs its own environment vocabulary.

```ts
import { isProductionEnvironment } from '@cdk-construct/core';

const retainData = isProductionEnvironment(environment);
```

## Stack Props Pattern

Keep environment-specific construct props in an app config file. Each stack gets
an environment object composed with package-specific props, then passes those
props into constructs in one place.

`bin/environments.ts`

```ts
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { type S3BucketProps } from '@cdk-construct/s3';

type AppEnvironment = EnvironmentConfig & {
  readonly s3: Omit<S3BucketProps, 'env'>;
};

export const environments: AppEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    s3: {
      bucketName: 'app-assets-dev',
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
    },
  },
];
```

`src/data-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { S3Bucket, type S3BucketProps } from '@cdk-construct/s3';

type DataStackProps = StackProps &
  EnvironmentConfig & {
    readonly s3: Omit<S3BucketProps, 'env'>;
  };

export class DataStack extends Stack {
  public constructor(scope: Construct, id: string, props: DataStackProps) {
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
import { DataStack } from '../src/data-stack.js';

const app = new App();

environments.forEach((environment) => {
  new DataStack(app, `data-${environment.env.name}`, environment);
});
```
