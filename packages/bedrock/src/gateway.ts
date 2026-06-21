import { ArnFormat, Stack } from 'aws-cdk-lib';
import { CfnGateway } from 'aws-cdk-lib/aws-bedrockagentcore';
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { validateBedrockEnvironmentConfig } from './environment.js';
import { bedrockTags } from './tags.js';
import { BedrockGatewayAuthorizerType, BedrockGatewayProtocolType } from './types.js';
import type {
  BedrockGatewayL1ResourceProps,
  BedrockGatewayProps,
  BedrockGatewayResources,
  BedrockGatewayRoleResourceProps,
  CreateBedrockGatewayResourceProps,
} from './types.js';

const AGENTCORE_SERVICE_PRINCIPAL = 'bedrock-agentcore.amazonaws.com';

const validateGatewayProps = (props: BedrockGatewayProps): void => {
  validateBedrockEnvironmentConfig(props);

  if (props.gatewayName.trim() === '') {
    throw new Error('Bedrock gatewayName is required.');
  }

  if (props.role !== undefined && props.roleArn !== undefined) {
    throw new Error('Provide either role or roleArn for a Bedrock gateway, not both.');
  }
};

const gatewayRuntimeArn = (scope: Construct): string => {
  return Stack.of(scope).formatArn({
    arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    service: 'bedrock-agentcore',
    resource: 'runtime',
    resourceName: '*',
  });
};

const gatewayLogArn = (scope: Construct, gatewayName: string): string => {
  return Stack.of(scope).formatArn({
    arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    service: 'logs',
    resource: 'log-group',
    resourceName: `/aws/bedrock-agentcore/gateways/${gatewayName}:*`,
  });
};

const defaultGatewayPolicyStatements = (
  scope: Construct,
  props: BedrockGatewayProps,
): PolicyStatement[] => {
  return [
    new PolicyStatement({
      sid: 'AllowBedrockModelInvoke',
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        Stack.of(scope).formatArn({
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          service: 'bedrock',
          account: '',
          resource: 'foundation-model',
          resourceName: '*',
        }),
      ],
    }),
    new PolicyStatement({
      sid: 'AllowAgentCoreRuntimeInvoke',
      effect: Effect.ALLOW,
      actions: [
        'bedrock-agentcore:GetRuntime',
        'bedrock-agentcore:InvokeAgentRuntime',
        'bedrock-agentcore:InvokeRuntime',
      ],
      resources: [gatewayRuntimeArn(scope)],
    }),
    new PolicyStatement({
      sid: 'AllowGatewayLogging',
      effect: Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [gatewayLogArn(scope, props.gatewayName)],
    }),
  ];
};

export const createBedrockGatewayRoleResource = (
  resourceProps: BedrockGatewayRoleResourceProps,
): Role => {
  const { scope, id, props } = resourceProps;
  const policyStatements = [
    ...defaultGatewayPolicyStatements(scope, props),
    ...(props.rolePolicyStatements ?? []),
  ];

  return new Role(scope, `${id}Role`, {
    assumedBy: new ServicePrincipal(AGENTCORE_SERVICE_PRINCIPAL),
    roleName: props.roleOverrides?.roleName ?? props.roleName,
    inlinePolicies: {
      BedrockGatewayPolicy: new PolicyDocument({
        statements: [...(props.roleOverrides?.policyStatements ?? policyStatements)],
      }),
    },
  });
};

export const createBedrockGatewayResource = (
  resourceProps: BedrockGatewayL1ResourceProps,
): CfnGateway => {
  const { scope, id, props, roleArn } = resourceProps;

  return new CfnGateway(scope, `${id}Gateway`, {
    authorizerConfiguration: props.authorizerConfiguration,
    authorizerType: props.authorizerType ?? BedrockGatewayAuthorizerType.AWS_IAM,
    description: props.description,
    exceptionLevel: props.exceptionLevel,
    interceptorConfigurations: props.interceptorConfigurations,
    kmsKeyArn: props.kmsKeyArn,
    name: props.gatewayName,
    policyEngineConfiguration: props.policyEngineConfiguration,
    protocolConfiguration: props.protocolConfiguration,
    protocolType: props.protocolType ?? BedrockGatewayProtocolType.MCP,
    roleArn,
    tags: bedrockTags(props),
    ...props.gatewayOverrides,
  });
};

export const createBedrockGatewayResources = (
  resourceProps: CreateBedrockGatewayResourceProps,
): BedrockGatewayResources => {
  const { scope, id, props } = resourceProps;
  validateGatewayProps(props);

  const role =
    props.role === undefined && props.roleArn === undefined
      ? createBedrockGatewayRoleResource(resourceProps)
      : undefined;
  const roleArn = props.roleArn ?? props.role?.roleArn ?? role?.roleArn;

  if (roleArn === undefined) {
    throw new Error('Bedrock gateway roleArn could not be resolved.');
  }

  return {
    gateway: createBedrockGatewayResource({
      scope,
      id,
      props,
      roleArn,
    }),
    role,
  };
};

export const createBedrockGateway = (
  scope: Construct,
  id: string,
  props: BedrockGatewayProps,
): BedrockGatewayResources => {
  return new BedrockGateway(scope, id, props);
};

export class BedrockGateway extends Construct implements BedrockGatewayResources {
  public readonly gateway: CfnGateway;

  public readonly role?: Role;

  public constructor(scope: Construct, id: string, props: BedrockGatewayProps) {
    super(scope, id);

    const resources = createBedrockGatewayResources({
      scope: this,
      id,
      props,
    });

    this.gateway = resources.gateway;
    this.role = resources.role;
  }
}
