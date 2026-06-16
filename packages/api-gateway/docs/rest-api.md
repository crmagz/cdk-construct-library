# API Gateway REST APIs

This package separates private and regional API Gateway REST APIs into distinct
constructs so the network boundary is intentional at the call site.

## Defaults

- Creates a REST API with CloudWatch execution logging enabled.
- Creates a dedicated access log group.
- Enables access logging with JSON standard fields.
- Enables X-Ray tracing and CloudWatch execution metrics.
- Disables data trace logging to avoid recording request and response payloads.
- Defaults methods to IAM authorization.
- Creates a reusable request validator for routes.
- Uses production log retention and retain policy for `prod` and `production`.
- Uses shorter log retention and destroy policy for non-production environments.
- Applies default stage throttling limits, with higher production limits.

## Private API

`PrivateApiGatewayRestApi` creates a private REST API and attaches a resource
policy that allows invocation only from the configured VPC endpoint source IDs.
The `ApiGatewayVpcEndpoint` helper creates an API Gateway interface endpoint with
explicit HTTPS ingress.

```ts
import { Stack } from 'aws-cdk-lib';
import { MockIntegration } from 'aws-cdk-lib/aws-apigateway';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { EnvironmentName } from '@cdk-construct/core';
import { ApiGatewayVpcEndpoint, PrivateApiGatewayRestApi } from '@cdk-construct/api-gateway';

const stack = new Stack();

const env = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const vpc = new Vpc(stack, 'Vpc', {
  maxAzs: 2,
  natGateways: 0,
  subnetConfiguration: [
    {
      name: 'Private',
      subnetType: SubnetType.PRIVATE_ISOLATED,
    },
  ],
});

const endpoint = new ApiGatewayVpcEndpoint(stack, 'ApiGatewayEndpoint', {
  vpc,
  allowedCidrs: ['10.0.0.0/24'],
});

const api = new PrivateApiGatewayRestApi(stack, 'OrdersApi', {
  apiName: 'orders-private-api',
  env,
  vpcEndpoints: [endpoint.endpoint],
});

const integration = new MockIntegration({
  integrationResponses: [{ statusCode: '200' }],
  requestTemplates: {
    'application/json': '{"statusCode": 200}',
  },
});

api.api.root.addResource('orders').addMethod('GET', integration, {
  methodResponses: [{ statusCode: '200' }],
  requestValidator: api.requestValidator,
});
```

If the endpoint is managed outside the stack, pass `vpcEndpointIds` instead:

```ts
new PrivateApiGatewayRestApi(stack, 'ImportedEndpointApi', {
  apiName: 'orders-private-api',
  env,
  vpcEndpointIds: ['vpce-0123456789abcdef0'],
});
```

## Regional API

`RegionalApiGatewayRestApi` creates a regional REST API with the same operational
defaults.

```ts
import { Stack } from 'aws-cdk-lib';
import { MockIntegration } from 'aws-cdk-lib/aws-apigateway';
import { EnvironmentName } from '@cdk-construct/core';
import { RegionalApiGatewayRestApi } from '@cdk-construct/api-gateway';

const stack = new Stack();

const api = new RegionalApiGatewayRestApi(stack, 'OrdersApi', {
  apiName: 'orders-api',
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});

const integration = new MockIntegration({
  integrationResponses: [{ statusCode: '200' }],
  requestTemplates: {
    'application/json': '{"statusCode": 200}',
  },
});

api.api.root.addResource('orders').addMethod('GET', integration, {
  methodResponses: [{ statusCode: '200' }],
  requestValidator: api.requestValidator,
});
```

## Overrides

Use override props when a workload needs lower-level CDK options. Endpoint type
is not an override because private and regional APIs are separate constructs.

```ts
new RegionalApiGatewayRestApi(stack, 'InternalApi', {
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

The constructs own logging, tracing, metrics, stage throttling, IAM
authorization defaults, and a reusable request validator. Private APIs also own
a source VPC endpoint resource policy. Override `restApiOverrides.defaultMethodOptions`
or per-method options only when a route has a different authorization model.
