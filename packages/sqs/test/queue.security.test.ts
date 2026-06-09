import { EnvironmentName } from '@cdk-construct/core';
import { jest } from '@jest/globals';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { AwsSolutionsChecks } from 'cdk-nag';

import { SqsQueue } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createSecurityApp = (): App => {
  const app = new App();
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return app;
};

describe('SqsQueue security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'SqsQueueSecurityStack');

    new SqsQueue(stack, 'Orders', {
      env: prodEnv,
      queueName: 'security-orders-prod',
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('synthesizes encrypted queues with SSL enforcement and a dead-letter queue', () => {
    const stack = new Stack();

    new SqsQueue(stack, 'Orders', {
      env: prodEnv,
      queueName: 'security-orders-prod',
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SQS::Queue', 2);
    template.resourceCountIs('AWS::SQS::QueuePolicy', 2);
    template.allResourcesProperties('AWS::SQS::Queue', {
      SqsManagedSseEnabled: true,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'security-orders-prod',
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 3,
      }),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'security-orders-prod-dl',
      RedrivePolicy: Match.absent(),
    });
    template.allResourcesProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 'sqs:*',
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          }),
        ]),
      },
    });
  });

  it('reports AWS Solutions findings when escape hatch overrides disable guardrails', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    const app = createSecurityApp();
    const stack = new Stack(app, 'InsecureSqsQueueStack');

    try {
      new SqsQueue(stack, 'Orders', {
        env: prodEnv,
        queueName: 'insecure-orders-prod',
        queueOverrides: {
          encryption: QueueEncryption.UNENCRYPTED,
          enforceSSL: false,
        },
        deadLetterQueueOverrides: {
          encryption: QueueEncryption.UNENCRYPTED,
          enforceSSL: false,
        },
      });

      app.synth();

      const validationOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(validationOutput).toContain('AwsSolutions-SQS2');
      expect(validationOutput).toContain('AwsSolutions-SQS4');
      expect(validationOutput).toContain('Status: failure');
    } finally {
      process.exitCode = originalExitCode;
      consoleErrorSpy.mockRestore();
    }
  });
});
