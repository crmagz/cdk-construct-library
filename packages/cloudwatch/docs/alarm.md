# CloudWatch Alarm

`CloudWatchAlarm` creates a CloudWatch alarm with environment-aware defaults and
optional dashboard creation.

## Usage

Keep environment-specific alarm props in a config file and pass the selected
props through the stack. The stack stays small and creates the alarm once.

`bin/environments.ts`

```ts
import { Duration } from 'aws-cdk-lib';
import { Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { type CloudWatchAlarmProps } from '@cdk-construct/cloudwatch';

type ObservabilityEnvironment = EnvironmentConfig & {
  readonly queueDepthAlarm: Omit<CloudWatchAlarmProps, 'env'>;
};

const queueDepthMetric = (queueName: string): Metric => {
  return new Metric({
    namespace: 'AWS/SQS',
    metricName: 'ApproximateNumberOfMessagesVisible',
    dimensionsMap: {
      QueueName: queueName,
    },
    statistic: 'Sum',
    period: Duration.minutes(5),
  });
};

export const environments: ObservabilityEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    queueDepthAlarm: {
      alarmName: 'orders-queue-depth-dev',
      metric: queueDepthMetric('orders-dev'),
      threshold: 250,
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    queueDepthAlarm: {
      alarmName: 'orders-queue-depth-prod',
      metric: queueDepthMetric('orders-prod'),
      threshold: 100,
      treatMissingData: TreatMissingData.BREACHING,
      createDashboard: true,
    },
  },
];
```

`src/observability-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { CloudWatchAlarm, type CloudWatchAlarmProps } from '@cdk-construct/cloudwatch';

type ObservabilityStackProps = StackProps &
  EnvironmentConfig & {
    readonly queueDepthAlarm: Omit<CloudWatchAlarmProps, 'env'>;
  };

export class ObservabilityStack extends Stack {
  public constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new CloudWatchAlarm(this, 'QueueDepthAlarm', {
      env: props.env,
      ...props.queueDepthAlarm,
    });
  }
}
```

## Environment Defaults

`env` is required so alarm behavior is explicit at the stack boundary.

| Environment | Evaluation periods | Datapoints to alarm | Missing data | Actions | Dashboard |
| --- | ---: | ---: | --- | --- | --- |
| `EnvironmentName.PROD` | 3 | 2 | Breaching | Enabled | Created |
| `EnvironmentName.STAGING` | 1 | 1 | Not breaching | Disabled | Skipped |
| `EnvironmentName.DEV` | 1 | 1 | Not breaching | Disabled | Skipped |

Override any default explicitly when a workload needs different behavior.

## Alarm Actions

Pass CDK alarm actions directly when an alarm should notify or trigger
automation.

```ts
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';

const topic = new Topic(this, 'AlarmTopic');

new CloudWatchAlarm(this, 'QueueDepthAlarm', {
  env: props.env,
  metric: props.queueDepthMetric,
  alarmName: 'orders-queue-depth-prod',
  threshold: 100,
  alarmActions: [new SnsAction(topic)],
});
```

## Dashboard Overrides

Production alarms create a dashboard by default. Non-production stacks can opt in
with `createDashboard`.

```ts
new CloudWatchAlarm(this, 'QueueDepthAlarm', {
  env: props.env,
  metric: props.queueDepthMetric,
  alarmName: 'orders-queue-depth-dev',
  threshold: 250,
  createDashboard: true,
  dashboardName: 'orders-dev-observability',
});
```

Use `dashboardWidgets` to replace the default alarm and metric widgets.

## Escape Hatches

Use `alarmOverrides`, `dashboardOverrides`, `alarmWidgetOverrides`, and
`graphWidgetOverrides` for CDK props not modeled directly by this package.

```ts
new CloudWatchAlarm(this, 'QueueDepthAlarm', {
  env: props.env,
  metric: props.queueDepthMetric,
  threshold: 100,
  alarmOverrides: {
    actionsEnabled: false,
  },
  dashboardOverrides: {
    periodOverride: 'inherit',
  },
});
```
