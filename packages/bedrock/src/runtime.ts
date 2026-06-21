import { CfnRuntime, CfnRuntimeEndpoint } from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';

import { validateBedrockEnvironmentConfig } from './environment.js';
import { bedrockTags } from './tags.js';
import { BedrockRuntimeNetworkMode, BedrockRuntimeProtocol } from './types.js';
import type {
  BedrockRuntimeEndpointProps,
  BedrockRuntimeEndpointResources,
  BedrockRuntimeProps,
  BedrockRuntimeResources,
  CreateBedrockRuntimeEndpointResourceProps,
  CreateBedrockRuntimeResourceProps,
} from './types.js';

const validateRuntimeProps = (props: BedrockRuntimeProps): void => {
  validateBedrockEnvironmentConfig(props);

  if (props.runtimeName.trim() === '') {
    throw new Error('Bedrock runtimeName is required.');
  }

  if (props.role !== undefined && props.roleArn !== undefined) {
    throw new Error('Provide either role or roleArn for a Bedrock runtime, not both.');
  }

  if (props.role === undefined && props.roleArn === undefined) {
    throw new Error('Bedrock runtimes require an execution role or roleArn.');
  }
};

const validateRuntimeEndpointProps = (props: BedrockRuntimeEndpointProps): void => {
  validateBedrockEnvironmentConfig(props);

  if (props.endpointName.trim() === '') {
    throw new Error('Bedrock runtime endpointName is required.');
  }

  if (props.runtime === undefined && props.runtimeId === undefined) {
    throw new Error('Bedrock runtime endpoints require runtime or runtimeId.');
  }
};

export const containerRuntimeArtifact = (
  containerUri: string,
): CfnRuntime.AgentRuntimeArtifactProperty => {
  return {
    containerConfiguration: {
      containerUri,
    },
  };
};

export const s3CodeRuntimeArtifact = (props: {
  readonly bucket: string;
  readonly prefix: string;
  readonly entryPoint: readonly string[];
  readonly runtime: string;
  readonly versionId?: string;
}): CfnRuntime.AgentRuntimeArtifactProperty => {
  return {
    codeConfiguration: {
      code: {
        s3: {
          bucket: props.bucket,
          prefix: props.prefix,
          versionId: props.versionId,
        },
      },
      entryPoint: [...props.entryPoint],
      runtime: props.runtime,
    },
  };
};

export const createBedrockRuntimeResource = (
  resourceProps: CreateBedrockRuntimeResourceProps,
): CfnRuntime => {
  const { scope, id, props } = resourceProps;
  validateRuntimeProps(props);

  return new CfnRuntime(scope, `${id}Runtime`, {
    agentRuntimeArtifact: props.artifact,
    agentRuntimeName: props.runtimeName,
    authorizerConfiguration: props.authorizerConfiguration,
    description: props.description,
    environmentVariables: props.environmentVariables,
    filesystemConfigurations: props.filesystemConfigurations,
    lifecycleConfiguration: props.lifecycleConfiguration,
    networkConfiguration: props.networkConfiguration ?? {
      networkMode: BedrockRuntimeNetworkMode.PUBLIC,
    },
    protocolConfiguration: props.protocolConfiguration ?? BedrockRuntimeProtocol.MCP,
    requestHeaderConfiguration: props.requestHeaderConfiguration,
    roleArn: props.roleArn ?? props.role?.roleArn ?? '',
    tags: bedrockTags(props),
    ...props.runtimeOverrides,
  });
};

export const createBedrockRuntimeResources = (
  resourceProps: CreateBedrockRuntimeResourceProps,
): BedrockRuntimeResources => {
  return {
    runtime: createBedrockRuntimeResource(resourceProps),
  };
};

export const createBedrockRuntime = (
  scope: Construct,
  id: string,
  props: BedrockRuntimeProps,
): BedrockRuntimeResources => {
  return new BedrockRuntime(scope, id, props);
};

export class BedrockRuntime extends Construct implements BedrockRuntimeResources {
  public readonly runtime: CfnRuntime;

  public constructor(scope: Construct, id: string, props: BedrockRuntimeProps) {
    super(scope, id);

    const resources = createBedrockRuntimeResources({
      scope: this,
      id,
      props,
    });

    this.runtime = resources.runtime;
  }
}

export const createBedrockRuntimeEndpointResource = (
  resourceProps: CreateBedrockRuntimeEndpointResourceProps,
): CfnRuntimeEndpoint => {
  const { scope, id, props } = resourceProps;
  validateRuntimeEndpointProps(props);

  return new CfnRuntimeEndpoint(scope, `${id}Endpoint`, {
    agentRuntimeId: props.runtimeId ?? props.runtime?.attrAgentRuntimeId ?? '',
    agentRuntimeVersion: props.runtimeVersion,
    description: props.description,
    name: props.endpointName,
    tags: bedrockTags(props),
    ...props.endpointOverrides,
  });
};

export const createBedrockRuntimeEndpointResources = (
  resourceProps: CreateBedrockRuntimeEndpointResourceProps,
): BedrockRuntimeEndpointResources => {
  return {
    endpoint: createBedrockRuntimeEndpointResource(resourceProps),
  };
};

export const createBedrockRuntimeEndpoint = (
  scope: Construct,
  id: string,
  props: BedrockRuntimeEndpointProps,
): BedrockRuntimeEndpointResources => {
  return new BedrockRuntimeEndpoint(scope, id, props);
};

export class BedrockRuntimeEndpoint extends Construct implements BedrockRuntimeEndpointResources {
  public readonly endpoint: CfnRuntimeEndpoint;

  public constructor(scope: Construct, id: string, props: BedrockRuntimeEndpointProps) {
    super(scope, id);

    const resources = createBedrockRuntimeEndpointResources({
      scope: this,
      id,
      props,
    });

    this.endpoint = resources.endpoint;
  }
}
