import type { CdkOverrides, EnvironmentAwareProps, TagMap } from '@cdk-construct/core';
import type { IResolvable } from 'aws-cdk-lib';
import type {
  CfnApiKeyCredentialProvider,
  CfnApiKeyCredentialProviderProps,
  CfnGateway,
  CfnGatewayProps,
  CfnGatewayTarget,
  CfnGatewayTargetProps,
  CfnOAuth2CredentialProvider,
  CfnOAuth2CredentialProviderProps,
  CfnRuntime,
  CfnRuntimeEndpoint,
  CfnRuntimeEndpointProps,
  CfnRuntimeProps,
} from 'aws-cdk-lib/aws-bedrockagentcore';
import type { IRole, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export const BedrockGatewayAuthorizerType = {
  AWS_IAM: 'AWS_IAM',
  CUSTOM_JWT: 'CUSTOM_JWT',
} as const;

export type BedrockGatewayAuthorizerType =
  (typeof BedrockGatewayAuthorizerType)[keyof typeof BedrockGatewayAuthorizerType];

export const BedrockGatewayProtocolType = {
  MCP: 'MCP',
} as const;

export type BedrockGatewayProtocolType =
  (typeof BedrockGatewayProtocolType)[keyof typeof BedrockGatewayProtocolType];

export const BedrockCredentialProviderType = {
  API_KEY: 'API_KEY',
  GATEWAY_IAM_ROLE: 'GATEWAY_IAM_ROLE',
  OAUTH: 'OAUTH',
} as const;

export type BedrockCredentialProviderType =
  (typeof BedrockCredentialProviderType)[keyof typeof BedrockCredentialProviderType];

export const BedrockRuntimeNetworkMode = {
  PUBLIC: 'PUBLIC',
  VPC: 'VPC',
} as const;

export type BedrockRuntimeNetworkMode =
  (typeof BedrockRuntimeNetworkMode)[keyof typeof BedrockRuntimeNetworkMode];

export const BedrockRuntimeProtocol = {
  HTTP: 'HTTP',
  MCP: 'MCP',
} as const;

export type BedrockRuntimeProtocol =
  (typeof BedrockRuntimeProtocol)[keyof typeof BedrockRuntimeProtocol];

export type BedrockPackageInfo = {
  readonly packageName: '@cdk-construct/bedrock';
  readonly service: 'Amazon Bedrock';
};

export type BedrockGatewayProps = EnvironmentAwareProps & {
  readonly gatewayName: string;
  readonly description?: string;
  readonly authorizerType?: BedrockGatewayAuthorizerType;
  readonly authorizerConfiguration?: CfnGatewayProps['authorizerConfiguration'];
  readonly exceptionLevel?: string;
  readonly interceptorConfigurations?: CfnGatewayProps['interceptorConfigurations'];
  readonly kmsKeyArn?: string;
  readonly policyEngineConfiguration?: CfnGatewayProps['policyEngineConfiguration'];
  readonly protocolConfiguration?: CfnGatewayProps['protocolConfiguration'];
  readonly protocolType?: BedrockGatewayProtocolType;
  readonly role?: IRole;
  readonly roleArn?: string;
  readonly roleName?: string;
  readonly rolePolicyStatements?: readonly PolicyStatement[];
  readonly tags?: TagMap;
  readonly gatewayOverrides?: CdkOverrides<CfnGatewayProps>;
  readonly roleOverrides?: CdkOverrides<{
    readonly roleName: string;
    readonly policyStatements: readonly PolicyStatement[];
  }>;
};

export type BedrockGatewayResources = {
  readonly gateway: CfnGateway;
  readonly role?: Role;
};

export type CreateBedrockGatewayResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockGatewayProps;
};

export type BedrockGatewayRoleResourceProps = CreateBedrockGatewayResourceProps;

export type BedrockGatewayL1ResourceProps = CreateBedrockGatewayResourceProps & {
  readonly roleArn: string;
};

export type BedrockGatewayTargetProps = EnvironmentAwareProps & {
  readonly targetName: string;
  readonly targetConfiguration: CfnGatewayTargetProps['targetConfiguration'];
  readonly credentialProviderConfigurations?: CfnGatewayTargetProps['credentialProviderConfigurations'];
  readonly description?: string;
  readonly gateway?: CfnGateway;
  readonly gatewayIdentifier?: string;
  readonly metadataConfiguration?: CfnGatewayTargetProps['metadataConfiguration'];
  readonly targetOverrides?: CdkOverrides<CfnGatewayTargetProps>;
};

export type BedrockGatewayTargetResources = {
  readonly target: CfnGatewayTarget;
};

export type CreateBedrockGatewayTargetResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockGatewayTargetProps;
};

export type BedrockRuntimeProps = EnvironmentAwareProps & {
  readonly runtimeName: string;
  readonly artifact: CfnRuntimeProps['agentRuntimeArtifact'];
  readonly role?: IRole;
  readonly roleArn?: string;
  readonly description?: string;
  readonly authorizerConfiguration?: CfnRuntimeProps['authorizerConfiguration'];
  readonly environmentVariables?: CfnRuntimeProps['environmentVariables'];
  readonly filesystemConfigurations?: CfnRuntimeProps['filesystemConfigurations'];
  readonly lifecycleConfiguration?: CfnRuntimeProps['lifecycleConfiguration'];
  readonly networkConfiguration?: CfnRuntimeProps['networkConfiguration'];
  readonly protocolConfiguration?: BedrockRuntimeProtocol;
  readonly requestHeaderConfiguration?: CfnRuntimeProps['requestHeaderConfiguration'];
  readonly tags?: TagMap;
  readonly runtimeOverrides?: CdkOverrides<CfnRuntimeProps>;
};

export type BedrockRuntimeResources = {
  readonly runtime: CfnRuntime;
};

export type CreateBedrockRuntimeResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockRuntimeProps;
};

export type BedrockRuntimeEndpointProps = EnvironmentAwareProps & {
  readonly endpointName: string;
  readonly runtime?: CfnRuntime;
  readonly runtimeId?: string;
  readonly runtimeVersion?: string;
  readonly description?: string;
  readonly tags?: TagMap;
  readonly endpointOverrides?: CdkOverrides<CfnRuntimeEndpointProps>;
};

export type BedrockRuntimeEndpointResources = {
  readonly endpoint: CfnRuntimeEndpoint;
};

export type CreateBedrockRuntimeEndpointResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockRuntimeEndpointProps;
};

export type BedrockOAuth2CredentialProviderProps = EnvironmentAwareProps & {
  readonly name: string;
  readonly credentialProviderVendor: string;
  readonly oauth2ProviderConfigInput?: CfnOAuth2CredentialProviderProps['oauth2ProviderConfigInput'];
  readonly tags?: TagMap;
  readonly providerOverrides?: CdkOverrides<CfnOAuth2CredentialProviderProps>;
};

export type BedrockOAuth2CredentialProviderResources = {
  readonly provider: CfnOAuth2CredentialProvider;
};

export type CreateBedrockOAuth2CredentialProviderResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockOAuth2CredentialProviderProps;
};

export type BedrockApiKeyCredentialProviderProps = EnvironmentAwareProps & {
  readonly name: string;
  readonly apiKey?: string;
  readonly tags?: TagMap;
  readonly providerOverrides?: CdkOverrides<CfnApiKeyCredentialProviderProps>;
};

export type BedrockApiKeyCredentialProviderResources = {
  readonly provider: CfnApiKeyCredentialProvider;
};

export type CreateBedrockApiKeyCredentialProviderResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: BedrockApiKeyCredentialProviderProps;
};

export type BedrockTaggableProps = EnvironmentAwareProps & {
  readonly tags?: TagMap;
};

export type BedrockTargetCredentialConfiguration =
  | CfnGatewayTarget.CredentialProviderConfigurationProperty
  | IResolvable;
