import {
  CfnApiKeyCredentialProvider,
  CfnOAuth2CredentialProvider,
} from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';

import { validateBedrockEnvironmentConfig } from './environment.js';
import { bedrockCfnTags } from './tags.js';
import type {
  BedrockApiKeyCredentialProviderProps,
  BedrockApiKeyCredentialProviderResources,
  BedrockOAuth2CredentialProviderProps,
  BedrockOAuth2CredentialProviderResources,
  CreateBedrockApiKeyCredentialProviderResourceProps,
  CreateBedrockOAuth2CredentialProviderResourceProps,
} from './types.js';

const validateProviderName = (props: { readonly name: string }): void => {
  if (props.name.trim() === '') {
    throw new Error('Bedrock credential provider name is required.');
  }
};

const validateOAuth2CredentialProviderProps = (
  props: BedrockOAuth2CredentialProviderProps,
): void => {
  validateBedrockEnvironmentConfig(props);
  validateProviderName(props);

  if (props.credentialProviderVendor.trim() === '') {
    throw new Error('Bedrock OAuth2 credential provider vendor is required.');
  }
};

const validateApiKeyCredentialProviderProps = (
  props: BedrockApiKeyCredentialProviderProps,
): void => {
  validateBedrockEnvironmentConfig(props);
  validateProviderName(props);
};

export const createBedrockOAuth2CredentialProviderResource = (
  resourceProps: CreateBedrockOAuth2CredentialProviderResourceProps,
): CfnOAuth2CredentialProvider => {
  const { scope, id, props } = resourceProps;
  validateOAuth2CredentialProviderProps(props);

  return new CfnOAuth2CredentialProvider(scope, `${id}OAuth2CredentialProvider`, {
    credentialProviderVendor: props.credentialProviderVendor,
    name: props.name,
    oauth2ProviderConfigInput: props.oauth2ProviderConfigInput,
    tags: bedrockCfnTags(props),
    ...props.providerOverrides,
  });
};

export const createBedrockOAuth2CredentialProviderResources = (
  resourceProps: CreateBedrockOAuth2CredentialProviderResourceProps,
): BedrockOAuth2CredentialProviderResources => {
  return {
    provider: createBedrockOAuth2CredentialProviderResource(resourceProps),
  };
};

export const createBedrockOAuth2CredentialProvider = (
  scope: Construct,
  id: string,
  props: BedrockOAuth2CredentialProviderProps,
): BedrockOAuth2CredentialProviderResources => {
  return new BedrockOAuth2CredentialProvider(scope, id, props);
};

export class BedrockOAuth2CredentialProvider
  extends Construct
  implements BedrockOAuth2CredentialProviderResources
{
  public readonly provider: CfnOAuth2CredentialProvider;

  public constructor(scope: Construct, id: string, props: BedrockOAuth2CredentialProviderProps) {
    super(scope, id);

    const resources = createBedrockOAuth2CredentialProviderResources({
      scope: this,
      id,
      props,
    });

    this.provider = resources.provider;
  }
}

export const createBedrockApiKeyCredentialProviderResource = (
  resourceProps: CreateBedrockApiKeyCredentialProviderResourceProps,
): CfnApiKeyCredentialProvider => {
  const { scope, id, props } = resourceProps;
  validateApiKeyCredentialProviderProps(props);

  return new CfnApiKeyCredentialProvider(scope, `${id}ApiKeyCredentialProvider`, {
    apiKey: props.apiKey,
    name: props.name,
    tags: bedrockCfnTags(props),
    ...props.providerOverrides,
  });
};

export const createBedrockApiKeyCredentialProviderResources = (
  resourceProps: CreateBedrockApiKeyCredentialProviderResourceProps,
): BedrockApiKeyCredentialProviderResources => {
  return {
    provider: createBedrockApiKeyCredentialProviderResource(resourceProps),
  };
};

export const createBedrockApiKeyCredentialProvider = (
  scope: Construct,
  id: string,
  props: BedrockApiKeyCredentialProviderProps,
): BedrockApiKeyCredentialProviderResources => {
  return new BedrockApiKeyCredentialProvider(scope, id, props);
};

export class BedrockApiKeyCredentialProvider
  extends Construct
  implements BedrockApiKeyCredentialProviderResources
{
  public readonly provider: CfnApiKeyCredentialProvider;

  public constructor(scope: Construct, id: string, props: BedrockApiKeyCredentialProviderProps) {
    super(scope, id);

    const resources = createBedrockApiKeyCredentialProviderResources({
      scope: this,
      id,
      props,
    });

    this.provider = resources.provider;
  }
}
