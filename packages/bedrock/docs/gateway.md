# Bedrock AgentCore Gateway

`BedrockGateway` creates an `AWS::BedrockAgentCore::Gateway` with required
environment config, environment tags, and an optional owned service role.

Use a project-level environment file to keep deployment differences outside the
construct call:

```ts
import type { BedrockGatewayProps } from '@cdk-construct/bedrock';
import { EnvironmentName } from '@cdk-construct/core';

export const environments: BedrockGatewayProps[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    gatewayName: 'orders-agent-dev',
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '222222222222',
      region: 'us-east-1',
    },
    gatewayName: 'orders-agent-prod',
    kmsKeyArn: 'arn:aws:kms:us-east-1:222222222222:key/example',
  },
];
```

Then wire the stack once:

```ts
environments.forEach((bedrock) => {
  new BedrockGateway(app, `Gateway-${bedrock.env.name}`, bedrock);
});
```

## Gateway Targets

`BedrockGatewayTarget` attaches MCP, HTTP runtime, API Gateway, Lambda, or schema-backed
targets to an existing gateway. Credential provider helper functions keep target
configuration readable:

```ts
import {
  BedrockGatewayTarget,
  iamGatewayTargetCredential,
} from '@cdk-construct/bedrock';

new BedrockGatewayTarget(this, 'OrdersTarget', {
  env: props.env,
  gateway: gateway.gateway,
  targetName: 'orders-tools',
  credentialProviderConfigurations: [
    iamGatewayTargetCredential({
      region: props.env.region,
      service: 'lambda',
    }),
  ],
  targetConfiguration: {
    mcp: {
      lambda: {
        lambdaArn: props.ordersTools.functionArn,
        toolSchema: {
          inlinePayload: props.ordersToolDefinitions,
        },
      },
    },
  },
});
```

## Overrides

Use `gatewayOverrides`, `roleOverrides`, or `targetOverrides` for properties that are not
yet modeled by the paved-road API. Overrides should be intentional and covered by a test
that validates the synthesized CloudFormation.
