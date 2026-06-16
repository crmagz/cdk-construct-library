import { EnvironmentName } from '@cdk-construct/core';
import { App, Duration, Stack, Validations } from 'aws-cdk-lib';
import { Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { AwsSolutionsChecks } from 'cdk-nag';

import { CloudWatchAlarm } from '../src/index.js';

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

describe('CloudWatchAlarm security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'CloudWatchAlarmSecurityStack');

    new CloudWatchAlarm(stack, 'QueueDepthAlarm', {
      env: prodEnv,
      alarmName: 'security-orders-queue-depth-prod',
      metric: new Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfMessagesVisible',
        dimensionsMap: {
          QueueName: 'security-orders-prod',
        },
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 100,
    });

    expect(() => app.synth()).not.toThrow();
  });
});
