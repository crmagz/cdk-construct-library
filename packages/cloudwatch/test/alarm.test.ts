import { EnvironmentName } from '@cdk-construct/core';
import { Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  Alarm,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import type { IAlarmAction } from 'aws-cdk-lib/aws-cloudwatch';

import {
  CloudWatchAlarm,
  createAlarmResource,
  createCloudWatchAlarm,
  createCloudWatchAlarmResources,
  createDashboardResource,
} from '../src/index.js';
import type { CloudWatchAlarmProps } from '../src/index.js';

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

const queueDepthMetric = new Metric({
  namespace: 'AWS/SQS',
  metricName: 'ApproximateNumberOfMessagesVisible',
  dimensionsMap: {
    QueueName: 'orders',
  },
  statistic: 'Sum',
  period: Duration.minutes(5),
});

const testAlarmAction = (alarmActionArn: string): IAlarmAction => {
  return {
    bind: () => ({ alarmActionArn }),
  };
};

const defaultProps = (props: Partial<CloudWatchAlarmProps> = {}): CloudWatchAlarmProps => {
  return {
    env: prodEnv,
    metric: queueDepthMetric,
    alarmName: 'orders-queue-depth-prod',
    alarmDescription: 'Orders queue has too many visible messages.',
    threshold: 100,
    ...props,
  };
};

const synthesizeAlarm = (alarm: CloudWatchAlarm): Template => {
  return Template.fromStack(Stack.of(alarm));
};

const getDashboardBody = (template: Template): string => {
  const dashboards = Object.values(template.findResources('AWS::CloudWatch::Dashboard'));
  const dashboard = dashboards[0] as
    | {
        readonly Properties?: {
          readonly DashboardBody?: unknown;
        };
      }
    | undefined;
  const dashboardBody = dashboard?.Properties?.DashboardBody;

  if (!dashboardBody) {
    throw new Error('Expected a dashboard body.');
  }

  return JSON.stringify(dashboardBody);
};

describe('CloudWatchAlarm', () => {
  it('creates a production alarm with active defaults and a dashboard', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(stack, 'QueueDepthAlarm', defaultProps());

    const template = synthesizeAlarm(alarm);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'orders-queue-depth-prod',
      AlarmDescription: 'Orders queue has too many visible messages.',
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateNumberOfMessagesVisible',
      Dimensions: [
        {
          Name: 'QueueName',
          Value: 'orders',
        },
      ],
      Statistic: 'Sum',
      Period: 300,
      Threshold: 100,
      EvaluationPeriods: 3,
      DatapointsToAlarm: 2,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      TreatMissingData: 'breaching',
      ActionsEnabled: true,
    });
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'orders-queue-depth-prod-dashboard',
      DashboardBody: Match.anyValue(),
    });
  });

  it('uses quieter non-production defaults without a dashboard', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(
      stack,
      'DevQueueDepthAlarm',
      defaultProps({
        env: devEnv,
        alarmName: 'orders-queue-depth-dev',
      }),
    );

    const template = synthesizeAlarm(alarm);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'orders-queue-depth-dev',
      EvaluationPeriods: 1,
      DatapointsToAlarm: 1,
      TreatMissingData: 'notBreaching',
      ActionsEnabled: false,
    });
  });

  it('honors explicit alarm settings and action targets', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(
      stack,
      'ConfiguredQueueDepthAlarm',
      defaultProps({
        evaluationPeriods: 5,
        datapointsToAlarm: 4,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        actionsEnabled: false,
        alarmActions: [testAlarmAction('arn:aws:sns:us-east-1:123456789012:alarm-topic')],
        okActions: [testAlarmAction('arn:aws:sns:us-east-1:123456789012:ok-topic')],
        insufficientDataActions: [
          testAlarmAction('arn:aws:sns:us-east-1:123456789012:insufficient-data-topic'),
        ],
      }),
    );

    const template = synthesizeAlarm(alarm);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      EvaluationPeriods: 5,
      DatapointsToAlarm: 4,
      ComparisonOperator: 'GreaterThanThreshold',
      TreatMissingData: 'ignore',
      ActionsEnabled: false,
      AlarmActions: ['arn:aws:sns:us-east-1:123456789012:alarm-topic'],
      OKActions: ['arn:aws:sns:us-east-1:123456789012:ok-topic'],
      InsufficientDataActions: ['arn:aws:sns:us-east-1:123456789012:insufficient-data-topic'],
    });
  });

  it('allows dashboard and widget overrides', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(
      stack,
      'DashboardOverrideAlarm',
      defaultProps({
        dashboardName: 'orders-operations-prod',
        dashboardWidgets: [
          new GraphWidget({
            title: 'Queue depth',
            left: [queueDepthMetric],
          }),
        ],
        dashboardOverrides: {
          periodOverride: 'inherit',
        },
      }),
    );

    const template = synthesizeAlarm(alarm);
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'orders-operations-prod',
      DashboardBody: Match.anyValue(),
    });
  });

  it('uses the alarm override name for default dashboard and widget names', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(
      stack,
      'AlarmNameOverrideAlarm',
      defaultProps({
        alarmName: 'orders-queue-depth-prod',
        alarmOverrides: {
          alarmName: 'orders-queue-depth-critical-prod',
        },
      }),
    );

    const template = synthesizeAlarm(alarm);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'orders-queue-depth-critical-prod',
    });
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'orders-queue-depth-critical-prod-dashboard',
    });
    const dashboardBody = getDashboardBody(template);
    expect(dashboardBody).toContain('orders-queue-depth-critical-prod');
    expect(dashboardBody).toContain('orders-queue-depth-critical-prod metric');
  });

  it('caps default datapoints when evaluation periods are lowered', () => {
    const stack = new Stack();
    const alarm = new CloudWatchAlarm(
      stack,
      'SingleEvaluationAlarm',
      defaultProps({
        evaluationPeriods: 1,
      }),
    );

    const template = synthesizeAlarm(alarm);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      EvaluationPeriods: 1,
      DatapointsToAlarm: 1,
    });
  });

  it('rejects explicit datapoints greater than evaluation periods', () => {
    const stack = new Stack();

    expect(() => {
      new CloudWatchAlarm(
        stack,
        'InvalidDatapointsAlarm',
        defaultProps({
          evaluationPeriods: 2,
          datapointsToAlarm: 3,
        }),
      );
    }).toThrow('datapointsToAlarm (3) must be less than or equal to evaluationPeriods (2).');
  });
});

describe('createCloudWatchAlarm', () => {
  it('returns the alarm resources', () => {
    const stack = new Stack();
    const resources = createCloudWatchAlarm(stack, 'OrdersAlarm', defaultProps());

    expect(resources.alarm).toBeInstanceOf(Alarm);
    expect(resources.dashboard).toBeInstanceOf(Dashboard);
  });

  it('omits the dashboard property when no dashboard is created', () => {
    const stack = new Stack();
    const resources = createCloudWatchAlarm(
      stack,
      'OrdersDevAlarm',
      defaultProps({
        env: devEnv,
        alarmName: 'orders-queue-depth-dev',
      }),
    );

    expect(resources.alarm).toBeInstanceOf(Alarm);
    expect(Object.hasOwn(resources, 'dashboard')).toBe(false);
  });
});

describe('resource creators', () => {
  it('creates explicit resources from typed resource props', () => {
    const stack = new Stack();
    const props = defaultProps({
      alarmName: 'orders-resource-prod',
      createDashboard: true,
      dashboardName: 'orders-resource-prod-dashboard',
    });
    const defaults = {
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: TreatMissingData.BREACHING,
      actionsEnabled: true,
      createDashboard: true,
    };
    const alarm = createAlarmResource({
      scope: stack,
      id: 'OrdersResource',
      props,
      defaults,
    });
    const dashboard = createDashboardResource({
      scope: stack,
      id: 'OrdersResource',
      props,
      defaults,
      alarm,
    });
    const resources = createCloudWatchAlarmResources({
      scope: stack,
      id: 'OrdersResources',
      props,
    });

    expect(alarm).toBeInstanceOf(Alarm);
    expect(dashboard).toBeInstanceOf(Dashboard);
    expect(resources.alarm).toBeInstanceOf(Alarm);
    expect(resources.dashboard).toBeInstanceOf(Dashboard);
  });
});
