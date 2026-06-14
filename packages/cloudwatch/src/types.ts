import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type {
  Alarm,
  AlarmProps,
  AlarmWidgetProps,
  Dashboard,
  DashboardProps,
  GraphWidgetProps,
  IAlarmAction,
  IMetric,
  IWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import type { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import type { Construct } from 'constructs';

export type CloudWatchAlarmProps = EnvironmentAwareProps & {
  readonly metric: IMetric;
  readonly alarmName?: string;
  readonly alarmDescription?: string;
  readonly threshold: number;
  readonly evaluationPeriods?: number;
  readonly datapointsToAlarm?: number;
  readonly comparisonOperator?: ComparisonOperator;
  readonly treatMissingData?: TreatMissingData;
  readonly actionsEnabled?: boolean;
  readonly alarmActions?: readonly IAlarmAction[];
  readonly okActions?: readonly IAlarmAction[];
  readonly insufficientDataActions?: readonly IAlarmAction[];
  readonly createDashboard?: boolean;
  readonly dashboardName?: string;
  readonly dashboardWidgets?: readonly IWidget[];
  readonly alarmOverrides?: CdkOverrides<AlarmProps>;
  readonly dashboardOverrides?: CdkOverrides<DashboardProps>;
  readonly alarmWidgetOverrides?: CdkOverrides<AlarmWidgetProps>;
  readonly graphWidgetOverrides?: CdkOverrides<GraphWidgetProps>;
};

export type CloudWatchAlarmDefaults = {
  readonly evaluationPeriods: number;
  readonly datapointsToAlarm: number;
  readonly treatMissingData: TreatMissingData;
  readonly actionsEnabled: boolean;
  readonly createDashboard: boolean;
};

export type CloudWatchAlarmResources = {
  readonly alarm: Alarm;
  readonly dashboard?: Dashboard;
};

export type CloudWatchAlarmResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: CloudWatchAlarmProps;
  readonly defaults: CloudWatchAlarmDefaults;
};

export type CloudWatchDashboardResourceProps = CloudWatchAlarmResourceProps & {
  readonly alarm: Alarm;
};

export type CreateCloudWatchAlarmResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: CloudWatchAlarmProps;
};
