# @cdk-construct/bedrock

Environment-aware Amazon Bedrock AgentCore constructs for AWS CDK.

This package provides a small paved-road layer over Bedrock AgentCore L1 resources. It
focuses on predictable environment tagging, explicit runtime execution roles, scoped
gateway IAM defaults, and escape-hatch overrides when a project needs to drop to the
underlying CloudFormation properties.

## Install

```bash
npm install @cdk-construct/bedrock
```

## Example

```ts
import {
  BedrockGateway,
  BedrockRuntime,
  BedrockRuntimeEndpoint,
  containerRuntimeArtifact,
} from '@cdk-construct/bedrock';

const gateway = new BedrockGateway(this, 'AgentGateway', {
  env: props.env,
  gatewayName: props.bedrock.gatewayName,
});

const runtime = new BedrockRuntime(this, 'AgentRuntime', {
  env: props.env,
  runtimeName: props.bedrock.runtimeName,
  artifact: containerRuntimeArtifact(props.bedrock.containerUri),
  roleArn: props.bedrock.runtimeRoleArn,
});

new BedrockRuntimeEndpoint(this, 'AgentEndpoint', {
  env: props.env,
  endpointName: props.bedrock.endpointName,
  runtime: runtime.runtime,
});
```

## Docs

- [AgentCore Gateway](./docs/gateway.md)
- [AgentCore Runtime](./docs/runtime.md)
