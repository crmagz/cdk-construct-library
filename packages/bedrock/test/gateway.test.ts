import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import {
  BedrockGateway,
  BedrockGatewayAuthorizerType,
  apiKeyGatewayTargetCredential,
  createBedrockGateway,
  createBedrockGatewayResources,
  createBedrockGatewayTarget,
  createBedrockOAuth2CredentialProvider,
  iamGatewayTargetCredential,
  oauthGatewayTargetCredential,
} from '../src/index.js';
import type { BedrockGatewayProps, BedrockGatewayTargetProps } from '../src/index.js';

const env = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const defaultGatewayProps = (props: Partial<BedrockGatewayProps> = {}): BedrockGatewayProps => {
  return {
    env,
    gatewayName: 'orders-agent-gateway',
    ...props,
  };
};

const defaultTargetProps = (
  props: Partial<BedrockGatewayTargetProps> = {},
): BedrockGatewayTargetProps => {
  return {
    env,
    gatewayIdentifier: 'gateway-123',
    targetName: 'orders-tools',
    credentialProviderConfigurations: [
      iamGatewayTargetCredential({
        region: 'us-east-1',
        service: 'lambda',
      }),
    ],
    targetConfiguration: {
      mcp: {
        lambda: {
          lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders-tools',
          toolSchema: {
            inlinePayload: [
              {
                name: 'listOrders',
                description: 'List orders',
                inputSchema: {
                  type: 'object',
                },
              },
            ],
          },
        },
      },
    },
    ...props,
  };
};

describe('BedrockGateway', () => {
  it('creates a gateway with an owned service role and environment tags', () => {
    const stack = new Stack();

    new BedrockGateway(stack, 'OrdersGateway', defaultGatewayProps());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
      AuthorizerType: BedrockGatewayAuthorizerType.AWS_IAM,
      Name: 'orders-agent-gateway',
      ProtocolType: 'MCP',
      Tags: {
        Environment: EnvironmentName.PROD,
      },
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Principal: {
              Service: 'bedrock-agentcore.amazonaws.com',
            },
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      Policies: Match.arrayWith([
        Match.objectLike({
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Sid: 'AllowBedrockModelInvoke',
                Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              }),
              Match.objectLike({
                Sid: 'AllowAgentCoreRuntimeInvoke',
                Action: [
                  'bedrock-agentcore:GetRuntime',
                  'bedrock-agentcore:InvokeAgentRuntime',
                  'bedrock-agentcore:InvokeRuntime',
                ],
              }),
              Match.objectLike({
                Sid: 'AllowGatewayLogging',
                Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              }),
            ]),
          },
        }),
      ]),
    });
  });

  it('uses a supplied role ARN without creating an IAM role', () => {
    const stack = new Stack();

    new BedrockGateway(
      stack,
      'OrdersGateway',
      defaultGatewayProps({
        roleArn: 'arn:aws:iam::123456789012:role/orders-agentcore-gateway',
      }),
    );

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::IAM::Role', 0);
    template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
      RoleArn: 'arn:aws:iam::123456789012:role/orders-agentcore-gateway',
    });
  });

  it('supports factory helpers', () => {
    const stack = new Stack();

    const resources = createBedrockGatewayResources({
      scope: stack,
      id: 'OrdersGateway',
      props: defaultGatewayProps(),
    });
    const factoryResources = createBedrockGateway(
      stack,
      'BillingGateway',
      defaultGatewayProps({
        gatewayName: 'billing-agent-gateway',
      }),
    );

    expect(resources.gateway.attrGatewayIdentifier).toBeDefined();
    expect(factoryResources.gateway.attrGatewayIdentifier).toBeDefined();
  });

  it('rejects missing environment config and ambiguous role inputs', () => {
    const stack = new Stack();

    expect(
      () =>
        new BedrockGateway(stack, 'MissingEnvGateway', {
          gatewayName: 'orders-agent-gateway',
        } as BedrockGatewayProps),
    ).toThrow('Environment config is required');
    expect(
      () =>
        new BedrockGateway(
          stack,
          'AmbiguousGateway',
          defaultGatewayProps({
            roleArn: 'arn:aws:iam::123456789012:role/orders-agentcore-gateway',
            role: {
              roleArn: 'arn:aws:iam::123456789012:role/imported',
            } as BedrockGatewayProps['role'],
          }),
        ),
    ).toThrow('Provide either role or roleArn');
  });
});

describe('BedrockGatewayTarget', () => {
  it('creates a Lambda MCP gateway target', () => {
    const stack = new Stack();

    createBedrockGatewayTarget(stack, 'OrdersTarget', defaultTargetProps());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::GatewayTarget', {
      GatewayIdentifier: 'gateway-123',
      Name: 'orders-tools',
      CredentialProviderConfigurations: Match.arrayWith([
        {
          CredentialProviderType: 'GATEWAY_IAM_ROLE',
          CredentialProvider: {
            IamCredentialProvider: {
              Region: 'us-east-1',
              Service: 'lambda',
            },
          },
        },
      ]),
      TargetConfiguration: {
        Mcp: Match.objectLike({
          Lambda: Match.objectLike({
            LambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:orders-tools',
          }),
        }),
      },
    });
  });

  it('builds OAuth and API key credential provider configurations', () => {
    expect(
      oauthGatewayTargetCredential({
        providerArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:oauth2/test',
        scopes: ['orders:read'],
      }),
    ).toMatchObject({
      credentialProviderType: 'OAUTH',
      credentialProvider: {
        oauthCredentialProvider: {
          scopes: ['orders:read'],
        },
      },
    });
    expect(
      apiKeyGatewayTargetCredential({
        providerArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:apikey/test',
        credentialParameterName: 'x-api-key',
      }),
    ).toMatchObject({
      credentialProviderType: 'API_KEY',
      credentialProvider: {
        apiKeyCredentialProvider: {
          credentialParameterName: 'x-api-key',
        },
      },
    });
  });

  it('uses a gateway construct reference for the target gateway identifier', () => {
    const stack = new Stack();
    const gateway = new BedrockGateway(
      stack,
      'OrdersGateway',
      defaultGatewayProps({
        roleArn: 'arn:aws:iam::123456789012:role/orders-agentcore-gateway',
      }),
    );

    createBedrockGatewayTarget(
      stack,
      'OrdersTarget',
      defaultTargetProps({
        gateway: gateway.gateway,
        gatewayIdentifier: undefined,
      }),
    );

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 1);
  });

  it('rejects missing gateway identifiers', () => {
    const stack = new Stack();

    expect(() =>
      createBedrockGatewayTarget(
        stack,
        'OrdersTarget',
        defaultTargetProps({
          gatewayIdentifier: undefined,
        }),
      ),
    ).toThrow('Bedrock gateway targets require gateway or gatewayIdentifier');
  });
});

describe('Bedrock credential providers', () => {
  it('creates native OAuth2 credential providers', () => {
    const stack = new Stack();

    createBedrockOAuth2CredentialProvider(stack, 'GithubProvider', {
      env,
      credentialProviderVendor: 'GithubOauth2',
      name: 'github-orders',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::OAuth2CredentialProvider', {
      CredentialProviderVendor: 'GithubOauth2',
      Name: 'github-orders',
      Tags: Match.arrayWith([
        {
          Key: 'Environment',
          Value: EnvironmentName.PROD,
        },
      ]),
    });
  });
});
