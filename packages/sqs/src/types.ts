import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import { Duration } from 'aws-cdk-lib';
import type { IQueue, Queue, QueueProps } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export type SqsQueueProps = EnvironmentAwareProps & {
  readonly queueName: string;
  readonly fifo?: boolean;
  readonly deadLetterQueueName?: string;
  readonly maxReceiveCount?: number;
  readonly deliveryDelay?: Duration;
  readonly retentionPeriod?: Duration;
  readonly visibilityTimeout?: Duration;
  readonly receiveMessageWaitTime?: Duration;
  readonly queueOverrides?: CdkOverrides<QueueProps>;
  readonly deadLetterQueueOverrides?: CdkOverrides<QueueProps>;
};

export type SqsQueueDefaults = {
  readonly deliveryDelay: Duration;
  readonly retentionPeriod: Duration;
  readonly visibilityTimeout: Duration;
  readonly receiveMessageWaitTime: Duration;
  readonly maxReceiveCount: number;
};

export type SqsQueueResources = {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;
};

export type SqsDeadLetterQueueResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: SqsQueueProps;
  readonly defaults: SqsQueueDefaults;
};

export type SqsQueueResourceProps = SqsDeadLetterQueueResourceProps & {
  readonly deadLetterQueue: IQueue;
};

export type CreateSqsQueueResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: SqsQueueProps;
};
