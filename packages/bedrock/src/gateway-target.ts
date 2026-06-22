import { CfnGatewayTarget } from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';

import { validateBedrockEnvironmentConfig } from './environment.js';
import { BedrockCredentialProviderType } from './types.js';
import type {
  BedrockGatewayTargetProps,
  BedrockGatewayTargetResources,
  BedrockTargetCredentialConfiguration,
  CreateBedrockGatewayTargetResourceProps,
} from './types.js';

const validateGatewayTargetProps = (props: BedrockGatewayTargetProps): void => {
  validateBedrockEnvironmentConfig(props);

  if (props.targetName.trim() === '') {
    throw new Error('Bedrock gateway targetName is required.');
  }

  if (props.gateway === undefined && props.gatewayIdentifier === undefined) {
    throw new Error('Bedrock gateway targets require gateway or gatewayIdentifier.');
  }
};

export const oauthGatewayTargetCredential = (props: {
  readonly providerArn: string;
  readonly scopes: readonly string[];
  readonly customParameters?: Record<string, string>;
  readonly defaultReturnUrl?: string;
  readonly grantType?: string;
}): BedrockTargetCredentialConfiguration => {
  return {
    credentialProviderType: BedrockCredentialProviderType.OAUTH,
    credentialProvider: {
      oauthCredentialProvider: {
        customParameters: props.customParameters,
        defaultReturnUrl: props.defaultReturnUrl,
        grantType: props.grantType,
        providerArn: props.providerArn,
        scopes: [...props.scopes],
      },
    },
  };
};

export const apiKeyGatewayTargetCredential = (props: {
  readonly providerArn: string;
  readonly credentialLocation?: string;
  readonly credentialParameterName?: string;
  readonly credentialPrefix?: string;
}): BedrockTargetCredentialConfiguration => {
  return {
    credentialProviderType: BedrockCredentialProviderType.API_KEY,
    credentialProvider: {
      apiKeyCredentialProvider: {
        credentialLocation: props.credentialLocation,
        credentialParameterName: props.credentialParameterName,
        credentialPrefix: props.credentialPrefix,
        providerArn: props.providerArn,
      },
    },
  };
};

export const iamGatewayTargetCredential = (props: {
  readonly service: string;
  readonly region?: string;
}): BedrockTargetCredentialConfiguration => {
  return {
    credentialProviderType: BedrockCredentialProviderType.GATEWAY_IAM_ROLE,
    credentialProvider: {
      iamCredentialProvider: {
        region: props.region,
        service: props.service,
      },
    },
  };
};

export const createBedrockGatewayTargetResource = (
  resourceProps: CreateBedrockGatewayTargetResourceProps,
): CfnGatewayTarget => {
  const { scope, id, props } = resourceProps;
  validateGatewayTargetProps(props);

  return new CfnGatewayTarget(scope, `${id}Target`, {
    credentialProviderConfigurations: props.credentialProviderConfigurations,
    description: props.description,
    gatewayIdentifier: props.gatewayIdentifier ?? props.gateway?.attrGatewayIdentifier,
    metadataConfiguration: props.metadataConfiguration,
    name: props.targetName,
    targetConfiguration: props.targetConfiguration,
    ...props.targetOverrides,
  });
};

export const createBedrockGatewayTargetResources = (
  resourceProps: CreateBedrockGatewayTargetResourceProps,
): BedrockGatewayTargetResources => {
  return {
    target: createBedrockGatewayTargetResource(resourceProps),
  };
};

export const createBedrockGatewayTarget = (
  scope: Construct,
  id: string,
  props: BedrockGatewayTargetProps,
): BedrockGatewayTargetResources => {
  return new BedrockGatewayTarget(scope, id, props);
};

export class BedrockGatewayTarget extends Construct implements BedrockGatewayTargetResources {
  public readonly target: CfnGatewayTarget;

  public constructor(scope: Construct, id: string, props: BedrockGatewayTargetProps) {
    super(scope, id);

    const resources = createBedrockGatewayTargetResources({
      scope: this,
      id,
      props,
    });

    this.target = resources.target;
  }
}
