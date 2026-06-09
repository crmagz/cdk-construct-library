import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { Duration } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import type { QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import type {
  CreateSqsQueueResourceProps,
  SqsDeadLetterQueueResourceProps,
  SqsQueueDefaults,
  SqsQueueProps,
  SqsQueueResourceProps,
  SqsQueueResources,
} from './types.js';

const DEFAULT_DELIVERY_DELAY = Duration.millis(0);
const DEFAULT_PROD_RETENTION_PERIOD = Duration.days(14);
const DEFAULT_NON_PROD_RETENTION_PERIOD = Duration.days(4);
const DEFAULT_VISIBILITY_TIMEOUT = Duration.minutes(1);
const DEFAULT_RECEIVE_MESSAGE_WAIT_TIME = Duration.seconds(20);
const DEFAULT_MAX_RECEIVE_COUNT = 3;

const defaultsForEnvironment = (props: SqsQueueProps): SqsQueueDefaults => {
  const environment = resolveEnvironmentConfig(props);

  return {
    deliveryDelay: DEFAULT_DELIVERY_DELAY,
    retentionPeriod: isProductionEnvironment(environment)
      ? DEFAULT_PROD_RETENTION_PERIOD
      : DEFAULT_NON_PROD_RETENTION_PERIOD,
    visibilityTimeout: DEFAULT_VISIBILITY_TIMEOUT,
    receiveMessageWaitTime: DEFAULT_RECEIVE_MESSAGE_WAIT_TIME,
    maxReceiveCount: DEFAULT_MAX_RECEIVE_COUNT,
  };
};

const normalizeFifoQueueName = (queueName: string, fifo: boolean): string => {
  if (!fifo || queueName.endsWith('.fifo')) {
    return queueName;
  }

  return `${queueName}.fifo`;
};

const stripFifoSuffix = (queueName: string): string => {
  return queueName.endsWith('.fifo') ? queueName.slice(0, -5) : queueName;
};

const resolveFifo = (props: SqsQueueProps): boolean => {
  return (
    props.fifo === true ||
    props.queueName.endsWith('.fifo') ||
    props.deadLetterQueueName?.endsWith('.fifo') === true
  );
};

const resolveQueueName = (props: SqsQueueProps): string => {
  return normalizeFifoQueueName(props.queueName, resolveFifo(props));
};

const resolveDeadLetterQueueName = (props: SqsQueueProps): string => {
  const fifo = resolveFifo(props);

  if (props.deadLetterQueueName) {
    return normalizeFifoQueueName(props.deadLetterQueueName, fifo);
  }

  return normalizeFifoQueueName(`${stripFifoSuffix(props.queueName)}-dl`, fifo);
};

const createBaseQueueProps = (
  queueName: string,
  props: SqsQueueProps,
  defaults: SqsQueueDefaults,
): QueueProps => {
  return {
    queueName,
    fifo: resolveFifo(props),
    encryption: QueueEncryption.SQS_MANAGED,
    enforceSSL: true,
    deliveryDelay: props.deliveryDelay ?? defaults.deliveryDelay,
    retentionPeriod: props.retentionPeriod ?? defaults.retentionPeriod,
  };
};

export class SqsQueue extends Construct {
  public readonly queue: Queue;
  public readonly deadLetterQueue: Queue;

  public constructor(scope: Construct, id: string, props: SqsQueueProps) {
    super(scope, id);

    const resources = createSqsQueueResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.queue = resources.queue;
    this.deadLetterQueue = resources.deadLetterQueue;
  }
}

export const createDeadLetterQueueResource = (
  resourceProps: SqsDeadLetterQueueResourceProps,
): Queue => {
  const { scope, id, props, defaults } = resourceProps;

  return new Queue(scope, `${id}DeadLetterQueue`, {
    ...createBaseQueueProps(resolveDeadLetterQueueName(props), props, defaults),
    ...props.deadLetterQueueOverrides,
  });
};

export const createQueueResource = (resourceProps: SqsQueueResourceProps): Queue => {
  const { scope, id, props, defaults, deadLetterQueue } = resourceProps;

  return new Queue(scope, `${id}Queue`, {
    ...createBaseQueueProps(resolveQueueName(props), props, defaults),
    deadLetterQueue: {
      queue: deadLetterQueue,
      maxReceiveCount: props.maxReceiveCount ?? defaults.maxReceiveCount,
    },
    visibilityTimeout: props.visibilityTimeout ?? defaults.visibilityTimeout,
    receiveMessageWaitTime: props.receiveMessageWaitTime ?? defaults.receiveMessageWaitTime,
    ...props.queueOverrides,
  });
};

export const createSqsQueueResources = (
  resourceProps: CreateSqsQueueResourceProps,
): SqsQueueResources => {
  const defaults = defaultsForEnvironment(resourceProps.props);
  const deadLetterQueue = createDeadLetterQueueResource({
    ...resourceProps,
    defaults,
  });
  const queue = createQueueResource({
    ...resourceProps,
    defaults,
    deadLetterQueue,
  });

  return { queue, deadLetterQueue };
};

export const createSqsQueue = (
  scope: Construct,
  id: string,
  props: SqsQueueProps,
): SqsQueueResources => {
  const sqsQueue = new SqsQueue(scope, id, props);

  return {
    queue: sqsQueue.queue,
    deadLetterQueue: sqsQueue.deadLetterQueue,
  };
};
