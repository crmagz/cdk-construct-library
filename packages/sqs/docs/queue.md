# SQS Queue

`SqsQueue` creates an SQS queue with a paired dead-letter queue, server-side
encryption, SSL enforcement, and environment-aware retention defaults.

## Usage

Keep environment-specific queue props in a config file and pass the selected
props through the stack. The stack stays small and creates the queue once.

`bin/environments.ts`

```ts
import { Duration } from 'aws-cdk-lib';
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { type SqsQueueProps } from '@cdk-construct/sqs';

type MessagingEnvironment = EnvironmentConfig & {
  readonly sqs: Omit<SqsQueueProps, 'env'>;
};

export const environments: MessagingEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    sqs: {
      queueName: 'orders-dev',
      retentionPeriod: Duration.days(2),
    },
  },
  {
    env: {
      name: EnvironmentName.STAGING,
      account: '222222222222',
      region: 'us-east-1',
    },
    sqs: {
      queueName: 'orders-staging',
      visibilityTimeout: Duration.minutes(2),
      maxReceiveCount: 5,
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    sqs: {
      queueName: 'orders-prod',
      retentionPeriod: Duration.days(14),
      receiveMessageWaitTime: Duration.seconds(20),
    },
  },
];
```

`src/messaging-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { SqsQueue, type SqsQueueProps } from '@cdk-construct/sqs';

type MessagingStackProps = StackProps &
  EnvironmentConfig & {
    readonly sqs: Omit<SqsQueueProps, 'env'>;
  };

export class MessagingStack extends Stack {
  public constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new SqsQueue(this, 'Orders', {
      env: props.env,
      ...props.sqs,
    });
  }
}
```

`bin/app.ts`

```ts
import { App } from 'aws-cdk-lib';
import { environments } from './environments.js';
import { MessagingStack } from '../src/messaging-stack.js';

const app = new App();

environments.forEach((environment) => {
  new MessagingStack(app, `messaging-${environment.env.name}`, environment);
});
```

## Environment Defaults

`env` is required so queue retention defaults are selected intentionally at the
stack boundary.

| Environment | Retention period | Delivery delay | Visibility timeout | Receive wait | Max receives |
| --- | --- | --- | --- | --- | --- |
| `EnvironmentName.PROD` | 14 days | 0 seconds | 60 seconds | 20 seconds | 3 |
| `EnvironmentName.STAGING` | 4 days | 0 seconds | 60 seconds | 20 seconds | 3 |
| `EnvironmentName.DEV` | 4 days | 0 seconds | 60 seconds | 20 seconds | 3 |

Override any default explicitly when a workload needs different behavior.

## FIFO Queues

Set `fifo: true` and provide the base queue name. The construct adds `.fifo` to
the main and dead-letter queue names when needed.

```ts
new SqsQueue(this, 'Events', {
  env: props.env,
  queueName: 'events',
  fifo: true,
});
```

## Escape Hatch

Use `queueOverrides` or `deadLetterQueueOverrides` for CDK `QueueProps` not
modeled directly by this package.

```ts
new SqsQueue(this, 'Orders', {
  env: props.env,
  queueName: 'orders-prod',
  queueOverrides: {
    contentBasedDeduplication: true,
  },
});
```
