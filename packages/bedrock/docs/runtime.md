# Bedrock AgentCore Runtime

`BedrockRuntime` creates an `AWS::BedrockAgentCore::Runtime` from a container or S3 code
artifact. Runtime execution role permissions depend on the artifact source and runtime
behavior, so this construct requires a supplied role or role ARN instead of guessing broad
ECR, S3, or model permissions.

## Container Runtime

```ts
import {
  BedrockRuntime,
  BedrockRuntimeEndpoint,
  containerRuntimeArtifact,
} from '@cdk-construct/bedrock';

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

## S3 Code Runtime

```ts
import { BedrockRuntime, s3CodeRuntimeArtifact } from '@cdk-construct/bedrock';

new BedrockRuntime(this, 'AgentRuntime', {
  env: props.env,
  runtimeName: props.bedrock.runtimeName,
  artifact: s3CodeRuntimeArtifact({
    bucket: props.bedrock.artifactBucketName,
    prefix: props.bedrock.artifactKey,
    entryPoint: ['python', '-m', 'app'],
    runtime: 'PYTHON_3_12',
  }),
  roleArn: props.bedrock.runtimeRoleArn,
});
```

## VPC Runtime

The default network mode is public. Pass `networkConfiguration` when the runtime should
run in a VPC:

```ts
new BedrockRuntime(this, 'PrivateAgentRuntime', {
  env: props.env,
  runtimeName: props.bedrock.runtimeName,
  artifact: containerRuntimeArtifact(props.bedrock.containerUri),
  roleArn: props.bedrock.runtimeRoleArn,
  networkConfiguration: {
    networkMode: 'VPC',
    networkModeConfig: {
      subnets: props.bedrock.subnetIds,
      securityGroups: props.bedrock.securityGroupIds,
    },
  },
});
```
