import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import {
  BedrockRuntime,
  BedrockRuntimeEndpoint,
  BedrockRuntimeNetworkMode,
  containerRuntimeArtifact,
  createBedrockApiKeyCredentialProvider,
  createBedrockRuntime,
  createBedrockRuntimeEndpoint,
  s3CodeRuntimeArtifact,
} from '../src/index.js';
import type { BedrockRuntimeEndpointProps, BedrockRuntimeProps } from '../src/index.js';

const env = {
  name: EnvironmentName.DEV,
  account: '123456789012',
  region: 'us-east-1',
};

const runtimeRoleArn = 'arn:aws:iam::123456789012:role/orders-agent-runtime';

const defaultRuntimeProps = (props: Partial<BedrockRuntimeProps> = {}): BedrockRuntimeProps => {
  return {
    env,
    runtimeName: 'orders-agent-runtime',
    artifact: containerRuntimeArtifact(
      '123456789012.dkr.ecr.us-east-1.amazonaws.com/orders-agent:latest',
    ),
    roleArn: runtimeRoleArn,
    ...props,
  };
};

const defaultEndpointProps = (
  props: Partial<BedrockRuntimeEndpointProps> = {},
): BedrockRuntimeEndpointProps => {
  return {
    env,
    endpointName: 'orders-agent',
    runtimeId: 'orders-agent-runtime-id',
    ...props,
  };
};

describe('BedrockRuntime', () => {
  it('creates a public MCP runtime from a container artifact', () => {
    const stack = new Stack();

    new BedrockRuntime(stack, 'OrdersRuntime', defaultRuntimeProps());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      AgentRuntimeArtifact: {
        ContainerConfiguration: {
          ContainerUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/orders-agent:latest',
        },
      },
      AgentRuntimeName: 'orders-agent-runtime',
      NetworkConfiguration: {
        NetworkMode: BedrockRuntimeNetworkMode.PUBLIC,
      },
      ProtocolConfiguration: 'MCP',
      RoleArn: runtimeRoleArn,
      Tags: {
        Environment: EnvironmentName.DEV,
      },
    });
  });

  it('creates a runtime from an S3 code artifact with VPC networking overrides', () => {
    const stack = new Stack();

    createBedrockRuntime(
      stack,
      'OrdersRuntime',
      defaultRuntimeProps({
        artifact: s3CodeRuntimeArtifact({
          bucket: 'orders-agent-artifacts',
          prefix: 'runtime.zip',
          entryPoint: ['python', '-m', 'app'],
          runtime: 'PYTHON_3_12',
        }),
        networkConfiguration: {
          networkMode: BedrockRuntimeNetworkMode.VPC,
          networkModeConfig: {
            subnets: ['subnet-11111111111111111'],
            securityGroups: ['sg-11111111111111111'],
          },
        },
      }),
    );

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      AgentRuntimeArtifact: {
        CodeConfiguration: {
          Code: {
            S3: {
              Bucket: 'orders-agent-artifacts',
              Prefix: 'runtime.zip',
            },
          },
          EntryPoint: ['python', '-m', 'app'],
          Runtime: 'PYTHON_3_12',
        },
      },
      NetworkConfiguration: {
        NetworkMode: 'VPC',
        NetworkModeConfig: {
          Subnets: ['subnet-11111111111111111'],
          SecurityGroups: ['sg-11111111111111111'],
        },
      },
    });
  });

  it('requires an explicit runtime role or role ARN', () => {
    const stack = new Stack();

    expect(
      () =>
        new BedrockRuntime(
          stack,
          'OrdersRuntime',
          defaultRuntimeProps({
            roleArn: undefined,
          }),
        ),
    ).toThrow('Bedrock runtimes require an execution role or roleArn');
  });
});

describe('BedrockRuntimeEndpoint', () => {
  it('creates a runtime endpoint from an explicit runtime ID', () => {
    const stack = new Stack();

    new BedrockRuntimeEndpoint(stack, 'OrdersEndpoint', defaultEndpointProps());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::RuntimeEndpoint', {
      AgentRuntimeId: 'orders-agent-runtime-id',
      Name: 'orders-agent',
      Tags: {
        Environment: EnvironmentName.DEV,
      },
    });
  });

  it('creates a runtime endpoint from a runtime construct reference', () => {
    const stack = new Stack();
    const runtime = new BedrockRuntime(stack, 'OrdersRuntime', defaultRuntimeProps());

    createBedrockRuntimeEndpoint(
      stack,
      'OrdersEndpoint',
      defaultEndpointProps({
        runtime: runtime.runtime,
        runtimeId: undefined,
      }),
    );

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::RuntimeEndpoint', {
      AgentRuntimeId: Match.anyValue(),
      Name: 'orders-agent',
    });
  });

  it('rejects missing runtime references', () => {
    const stack = new Stack();

    expect(
      () =>
        new BedrockRuntimeEndpoint(
          stack,
          'OrdersEndpoint',
          defaultEndpointProps({
            runtimeId: undefined,
          }),
        ),
    ).toThrow('Bedrock runtime endpoints require runtime or runtimeId');
  });
});

describe('Bedrock API key credential provider', () => {
  it('creates native API key credential providers without requiring inline secrets', () => {
    const stack = new Stack();

    createBedrockApiKeyCredentialProvider(stack, 'ApiKeyProvider', {
      env,
      name: 'orders-api-key',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::ApiKeyCredentialProvider', {
      Name: 'orders-api-key',
      Tags: Match.arrayWith([
        {
          Key: 'Environment',
          Value: EnvironmentName.DEV,
        },
      ]),
    });
  });
});
