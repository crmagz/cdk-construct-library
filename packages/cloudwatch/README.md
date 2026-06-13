# @cdk-construct/cloudwatch

Environment-aware CloudWatch alarm constructs for AWS CDK.

## Overview

`CloudWatchAlarm` creates a CloudWatch alarm with production-oriented defaults,
quieter non-production behavior, optional alarm actions, and an optional
dashboard. Defaults can be overridden through typed props, with CDK override bags
available when a workload needs direct `AlarmProps`, `DashboardProps`, or widget
configuration.

## Install

```sh
npm install @cdk-construct/cloudwatch @cdk-construct/core
```

## Quick Start

```ts
import { Duration } from 'aws-cdk-lib';
import { Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { EnvironmentName } from '@cdk-construct/core';
import { CloudWatchAlarm } from '@cdk-construct/cloudwatch';

new CloudWatchAlarm(this, 'QueueDepthAlarm', {
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  alarmName: 'orders-queue-depth-prod',
  metric: new Metric({
    namespace: 'AWS/SQS',
    metricName: 'ApproximateNumberOfMessagesVisible',
    dimensionsMap: {
      QueueName: 'orders-prod',
    },
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 100,
});
```

## Defaults

- Production alarms evaluate 3 periods, require 2 breaching datapoints, treat
  missing data as breaching, enable actions, and create a dashboard.
- Non-production alarms evaluate 1 period, require 1 breaching datapoint, treat
  missing data as not breaching, disable actions, and skip dashboard creation.
- `alarmActions`, `okActions`, and `insufficientDataActions` wire direct CDK
  alarm action targets when provided.

## Documentation

- [Alarm construct](./docs/alarm.md)
