import { EnvironmentName } from '@cdk-construct/core';
import { Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Queue } from 'aws-cdk-lib/aws-sqs';

import {
  SqsQueue,
  createDeadLetterQueueResource,
  createQueueResource,
  createSqsQueue,
} from '../src/index.js';
import type { SqsQueueProps } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const devEnv = {
  name: EnvironmentName.DEV,
  account: '123456789012',
  region: 'us-east-1',
};

const synthesizeQueue = (queue: SqsQueue): Template => {
  return Template.fromStack(Stack.of(queue));
};

const defaultProps = (props: Partial<SqsQueueProps> = {}): SqsQueueProps => {
  return {
    env: prodEnv,
    queueName: 'orders',
    ...props,
  };
};

describe('SqsQueue', () => {
  it('creates a production queue pair with secure defaults', () => {
    const stack = new Stack();
    const queue = new SqsQueue(stack, 'OrdersQueue', defaultProps());

    const template = synthesizeQueue(queue);
    template.resourceCountIs('AWS::SQS::Queue', 2);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders',
      SqsManagedSseEnabled: true,
      DelaySeconds: 0,
      MessageRetentionPeriod: 1209600,
      VisibilityTimeout: 60,
      ReceiveMessageWaitTimeSeconds: 20,
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 3,
      }),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-dl',
      SqsManagedSseEnabled: true,
      DelaySeconds: 0,
      MessageRetentionPeriod: 1209600,
      RedrivePolicy: Match.absent(),
    });
    template.hasResourceProperties('AWS::SQS::QueuePolicy', {
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

  it('uses shorter non-production retention defaults', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'DevOrdersQueue',
      defaultProps({
        env: devEnv,
        queueName: 'orders-dev',
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-dev',
      MessageRetentionPeriod: 345600,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-dev-dl',
      MessageRetentionPeriod: 345600,
    });
  });

  it('creates FIFO queue names and dead-letter queue names', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'FifoOrdersQueue',
      defaultProps({
        queueName: 'orders',
        fifo: true,
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders.fifo',
      FifoQueue: true,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-dl.fifo',
      FifoQueue: true,
    });
  });

  it('infers FIFO queues from a suffixed queue name', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'InferredFifoOrdersQueue',
      defaultProps({
        queueName: 'orders.fifo',
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders.fifo',
      FifoQueue: true,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-dl.fifo',
      FifoQueue: true,
    });
  });

  it('infers FIFO queues from a suffixed dead-letter queue name', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'InferredFifoDeadLetterOrdersQueue',
      defaultProps({
        queueName: 'orders',
        deadLetterQueueName: 'orders-errors.fifo',
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders.fifo',
      FifoQueue: true,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-errors.fifo',
      FifoQueue: true,
    });
  });

  it('honors explicit queue settings', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'ConfiguredOrdersQueue',
      defaultProps({
        queueName: 'orders-configured',
        deadLetterQueueName: 'orders-configured-errors',
        deliveryDelay: Duration.seconds(5),
        retentionPeriod: Duration.days(7),
        visibilityTimeout: Duration.minutes(5),
        receiveMessageWaitTime: Duration.seconds(10),
        maxReceiveCount: 8,
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-configured',
      DelaySeconds: 5,
      MessageRetentionPeriod: 604800,
      VisibilityTimeout: 300,
      ReceiveMessageWaitTimeSeconds: 10,
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 8,
      }),
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-configured-errors',
      MessageRetentionPeriod: 604800,
    });
  });

  it('allows direct CDK queue overrides', () => {
    const stack = new Stack();
    const queue = new SqsQueue(
      stack,
      'OverrideOrdersQueue',
      defaultProps({
        queueName: 'orders-override',
        queueOverrides: {
          visibilityTimeout: Duration.minutes(10),
        },
        deadLetterQueueOverrides: {
          retentionPeriod: Duration.days(10),
        },
      }),
    );

    const template = synthesizeQueue(queue);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-override',
      VisibilityTimeout: 600,
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'orders-override-dl',
      MessageRetentionPeriod: 864000,
    });
  });
});

describe('createSqsQueue', () => {
  it('returns the queue resources', () => {
    const stack = new Stack();
    const resources = createSqsQueue(stack, 'Orders', defaultProps());

    expect(resources.queue).toBeInstanceOf(Queue);
    expect(resources.deadLetterQueue).toBeInstanceOf(Queue);
  });
});

describe('resource creators', () => {
  it('create explicit queue resources from typed resource props', () => {
    const stack = new Stack();
    const props = defaultProps({ queueName: 'orders-resource' });
    const defaults = {
      deliveryDelay: Duration.seconds(0),
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.minutes(1),
      receiveMessageWaitTime: Duration.seconds(20),
      maxReceiveCount: 3,
    };
    const deadLetterQueue = createDeadLetterQueueResource({
      scope: stack,
      id: 'Orders',
      props,
      defaults,
    });
    const queue = createQueueResource({
      scope: stack,
      id: 'Orders',
      props,
      defaults,
      deadLetterQueue,
    });

    expect(queue).toBeInstanceOf(Queue);
    expect(deadLetterQueue).toBeInstanceOf(Queue);
    Template.fromStack(stack).resourceCountIs('AWS::SQS::Queue', 2);
  });
});
