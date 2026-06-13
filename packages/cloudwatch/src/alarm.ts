import { isProductionEnvironment } from '@cdk-construct/core';
import {
  Alarm,
  AlarmWidget,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import type { AlarmProps, IWidget } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

import type {
  CloudWatchAlarmDefaults,
  CloudWatchAlarmProps,
  CloudWatchAlarmResourceProps,
  CloudWatchAlarmResources,
  CloudWatchDashboardResourceProps,
  CreateCloudWatchAlarmResourceProps,
} from './types.js';

const DEFAULT_PROD_EVALUATION_PERIODS = 3;
const DEFAULT_PROD_DATAPOINTS_TO_ALARM = 2;
const DEFAULT_NON_PROD_EVALUATION_PERIODS = 1;
const DEFAULT_NON_PROD_DATAPOINTS_TO_ALARM = 1;

const defaultsForEnvironment = (props: CloudWatchAlarmProps): CloudWatchAlarmDefaults => {
  if (isProductionEnvironment(props)) {
    return {
      evaluationPeriods: DEFAULT_PROD_EVALUATION_PERIODS,
      datapointsToAlarm: DEFAULT_PROD_DATAPOINTS_TO_ALARM,
      treatMissingData: TreatMissingData.BREACHING,
      actionsEnabled: true,
      createDashboard: true,
    };
  }

  return {
    evaluationPeriods: DEFAULT_NON_PROD_EVALUATION_PERIODS,
    datapointsToAlarm: DEFAULT_NON_PROD_DATAPOINTS_TO_ALARM,
    treatMissingData: TreatMissingData.NOT_BREACHING,
    actionsEnabled: false,
    createDashboard: false,
  };
};

const resolveDatapointsToAlarm = (
  props: CloudWatchAlarmProps,
  defaults: CloudWatchAlarmDefaults,
  evaluationPeriods: number,
): number => {
  return props.datapointsToAlarm ?? Math.min(defaults.datapointsToAlarm, evaluationPeriods);
};

const validateAlarmPeriods = (evaluationPeriods: number, datapointsToAlarm: number): void => {
  if (datapointsToAlarm > evaluationPeriods) {
    throw new Error(
      `datapointsToAlarm (${datapointsToAlarm}) must be less than or equal to evaluationPeriods (${evaluationPeriods}).`,
    );
  }
};

const addAlarmActions = (alarm: Alarm, props: CloudWatchAlarmProps): void => {
  if (props.alarmActions) {
    alarm.addAlarmAction(...props.alarmActions);
  }

  if (props.okActions) {
    alarm.addOkAction(...props.okActions);
  }

  if (props.insufficientDataActions) {
    alarm.addInsufficientDataAction(...props.insufficientDataActions);
  }
};

const createDefaultDashboardWidgets = (
  props: CloudWatchAlarmProps,
  alarm: Alarm,
): readonly IWidget[] => {
  return [
    new AlarmWidget({
      title: props.alarmName ?? 'Alarm',
      alarm,
      ...props.alarmWidgetOverrides,
    }),
    new GraphWidget({
      title: `${props.alarmName ?? 'Alarm'} metric`,
      left: [props.metric],
      ...props.graphWidgetOverrides,
    }),
  ];
};

const resolveDashboardName = (props: CloudWatchAlarmProps): string | undefined => {
  return props.dashboardName ?? (props.alarmName ? `${props.alarmName}-dashboard` : undefined);
};

export class CloudWatchAlarm extends Construct {
  public readonly alarm: Alarm;
  public readonly dashboard?: Dashboard;

  public constructor(scope: Construct, id: string, props: CloudWatchAlarmProps) {
    super(scope, id);

    const resources = createCloudWatchAlarmResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.alarm = resources.alarm;
    this.dashboard = resources.dashboard;
  }
}

export const createAlarmResource = (resourceProps: CloudWatchAlarmResourceProps): Alarm => {
  const { scope, id, props, defaults } = resourceProps;
  const evaluationPeriods = props.evaluationPeriods ?? defaults.evaluationPeriods;
  const datapointsToAlarm = resolveDatapointsToAlarm(props, defaults, evaluationPeriods);

  validateAlarmPeriods(evaluationPeriods, datapointsToAlarm);

  const alarmProps: AlarmProps = {
    metric: props.metric,
    alarmName: props.alarmName,
    alarmDescription: props.alarmDescription,
    threshold: props.threshold,
    evaluationPeriods,
    datapointsToAlarm,
    comparisonOperator:
      props.comparisonOperator ?? ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: props.treatMissingData ?? defaults.treatMissingData,
    actionsEnabled: props.actionsEnabled ?? defaults.actionsEnabled,
    ...props.alarmOverrides,
  };
  const alarm = new Alarm(scope, `${id}Alarm`, alarmProps);

  addAlarmActions(alarm, props);

  return alarm;
};

export const createDashboardResource = (
  resourceProps: CloudWatchDashboardResourceProps,
): Dashboard | undefined => {
  const { scope, id, props, defaults, alarm } = resourceProps;
  const createDashboard = props.createDashboard ?? defaults.createDashboard;

  if (!createDashboard) {
    return undefined;
  }

  const dashboard = new Dashboard(scope, `${id}Dashboard`, {
    dashboardName: resolveDashboardName(props),
    ...props.dashboardOverrides,
  });
  const widgets = props.dashboardWidgets
    ? [...props.dashboardWidgets]
    : createDefaultDashboardWidgets(props, alarm);

  dashboard.addWidgets(...widgets);

  return dashboard;
};

export const createCloudWatchAlarmResources = (
  resourceProps: CreateCloudWatchAlarmResourceProps,
): CloudWatchAlarmResources => {
  const defaults = defaultsForEnvironment(resourceProps.props);
  const alarm = createAlarmResource({
    ...resourceProps,
    defaults,
  });
  const dashboard = createDashboardResource({
    ...resourceProps,
    defaults,
    alarm,
  });

  return {
    alarm,
    dashboard,
  };
};

export const createCloudWatchAlarm = (
  scope: Construct,
  id: string,
  props: CloudWatchAlarmProps,
): CloudWatchAlarmResources => {
  const cloudWatchAlarm = new CloudWatchAlarm(scope, id, props);

  return {
    alarm: cloudWatchAlarm.alarm,
    dashboard: cloudWatchAlarm.dashboard,
  };
};
