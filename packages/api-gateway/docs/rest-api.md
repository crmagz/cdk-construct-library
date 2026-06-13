# API Gateway REST API

`ApiGatewayRestApi` creates a REST API foundation with operational defaults that should be present before application routes are added.

## Defaults

- Creates a regional REST API.
- Enables a CloudWatch role for execution logging.
- Creates a dedicated access log group.
- Enables access logging with JSON standard fields.
- Enables X-Ray tracing and CloudWatch execution metrics.
- Disables data trace logging to avoid recording request and response payloads.
- Defaults methods to IAM authorization.
- Creates a default request validator for methods to use.
- Uses production log retention and retain policy for `prod` and `production` environments.
- Uses shorter log retention and destroy policy for non-production environments.
- Applies default stage throttling limits, with higher production limits.

## Usage

```ts
import { Stack } from 'aws-cdk-lib';
import { EnvironmentName } from '@cdk-construct/core';
import { ApiGatewayRestApi } from '@cdk-construct/api-gateway';

const stack = new Stack();

const api = new ApiGatewayRestApi(stack, 'OrdersApi', {
  apiName: 'orders-api',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});

api.api.root.addResource('orders').addMethod('GET', integration, {
  requestValidator: api.requestValidator,
});
```

## Overrides

Use the override props when a workload needs to opt out of a default or set a lower-level CDK option.

```ts
new ApiGatewayRestApi(stack, 'InternalApi', {
  apiName: 'internal-api',
  env: {
    name: EnvironmentName.DEV,
    account: '123456789012',
    region: 'us-east-1',
  },
  stageName: 'dev',
  deployOptions: {
    throttlingRateLimit: 50,
    throttlingBurstLimit: 100,
  },
  restApiOverrides: {
    disableExecuteApiEndpoint: true,
  },
});
```

## Security Notes

The construct owns logging, tracing, metrics, stage throttling, IAM authorization defaults, and a reusable request validator. Override `restApiOverrides.defaultMethodOptions` or per-method options only when a route has a different authorization model.
