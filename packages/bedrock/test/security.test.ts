import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import {
  BedrockGateway,
  BedrockRuntime,
  BedrockRuntimeEndpoint,
  containerRuntimeArtifact,
  createBedrockGatewayTarget,
} from '../src/index.js';

const env = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createSecurityApp = (): App => {
  const app = new App();
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return app;
};

describe('Bedrock security', () => {
  it('passes AWS Solutions checks for externally managed execution roles', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'BedrockSecurityStack');

    try {
      const gateway = new BedrockGateway(stack, 'OrdersGateway', {
        env,
        gatewayName: 'orders-agent-gateway',
        roleArn: 'arn:aws:iam::123456789012:role/orders-agentcore-gateway',
      });
      const runtime = new BedrockRuntime(stack, 'OrdersRuntime', {
        env,
        runtimeName: 'orders-agent-runtime',
        artifact: containerRuntimeArtifact(
          '123456789012.dkr.ecr.us-east-1.amazonaws.com/orders-agent:latest',
        ),
        roleArn: 'arn:aws:iam::123456789012:role/orders-agent-runtime',
      });

      createBedrockGatewayTarget(stack, 'OrdersTarget', {
        env,
        gateway: gateway.gateway,
        targetName: 'orders-agent-runtime',
        targetConfiguration: {
          http: {
            agentcoreRuntime: {
              arn: runtime.runtime.attrAgentRuntimeArn,
            },
          },
        },
      });
      new BedrockRuntimeEndpoint(stack, 'OrdersEndpoint', {
        env,
        endpointName: 'orders-agent',
        runtime: runtime.runtime,
      });

      expect(() => app.synth()).not.toThrow();
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });

  it('synthesizes environment tags and avoids root principals in owned gateway roles', () => {
    const stack = new Stack();

    new BedrockGateway(stack, 'OrdersGateway', {
      env,
      gatewayName: 'orders-agent-gateway',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
      Tags: {
        Environment: EnvironmentName.PROD,
      },
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'bedrock-agentcore.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    });
  });
});
