# API Gateway REST APIs

This package separates private and regional API Gateway REST APIs into distinct
constructs so the network boundary is intentional at the call site. Both
constructs create one Lambda proxy route: `ANY /{proxy+}`.

Application routes should live inside the Lambda framework, such as FastAPI,
Zod-backed TypeScript handlers, or another HTTP router. CDK should own the edge
contract and operational guardrails, not every application path.

## Defaults

- Creates a REST API with CloudWatch execution logging enabled.
- Creates a dedicated access log group.
- Enables access logging with JSON standard fields.
- Enables X-Ray tracing and CloudWatch execution metrics.
- Disables data trace logging to avoid recording request and response payloads.
- Creates a Lambda `AWS_PROXY` integration.
- Creates a greedy `{proxy+}` resource with an `ANY` method.
- Defaults the proxy method to IAM authorization.
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
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { EnvironmentName } from '@cdk-construct/core';
import { ApiGatewayVpcEndpoint, PrivateApiGatewayRestApi } from '@cdk-construct/api-gateway';

const stack = new Stack();

const env = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const handler = new Function(stack, 'Handler', {
  runtime: Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: Code.fromInline('exports.handler = async () => ({ statusCode: 200, body: "ok" });'),
});

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

new PrivateApiGatewayRestApi(stack, 'OrdersApi', {
  apiName: 'orders-private-api',
  env,
  handler,
  vpcEndpoints: [endpoint.endpoint],
});
```

If the endpoint is managed outside the stack, pass `vpcEndpointIds` instead:

```ts
new PrivateApiGatewayRestApi(stack, 'ImportedEndpointApi', {
  apiName: 'orders-private-api',
  env,
  handler,
  vpcEndpointIds: ['vpce-0123456789abcdef0'],
});
```

## Regional API

`RegionalApiGatewayRestApi` creates a regional REST API with the same operational
defaults.

```ts
import { Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { EnvironmentName } from '@cdk-construct/core';
import { RegionalApiGatewayRestApi } from '@cdk-construct/api-gateway';

const stack = new Stack();

const handler = new Function(stack, 'Handler', {
  runtime: Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: Code.fromInline('exports.handler = async () => ({ statusCode: 200, body: "ok" });'),
});

new RegionalApiGatewayRestApi(stack, 'OrdersApi', {
  apiName: 'orders-api',
  handler,
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
});
```

## Overrides

Use override props when a workload needs lower-level CDK options. Endpoint type
and proxy integration are not generic REST API overrides because the construct
owns the API shape.

```ts
new RegionalApiGatewayRestApi(stack, 'InternalApi', {
  apiName: 'internal-api',
  handler,
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
  proxyMethodOptions: {
    apiKeyRequired: true,
  },
  restApiOverrides: {
    disableExecuteApiEndpoint: true,
  },
});
```

## Security Notes

The constructs own logging, tracing, metrics, stage throttling, IAM
authorization defaults, and the Lambda proxy integration. Private APIs also own
a source VPC endpoint resource policy. Override `proxyMethodOptions` only when
the whole API has a different authorization model.
