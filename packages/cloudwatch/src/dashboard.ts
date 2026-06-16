import { AlarmWidget, Dashboard, GraphWidget } from 'aws-cdk-lib/aws-cloudwatch';
import type { IWidget } from 'aws-cdk-lib/aws-cloudwatch';

import { resolveAlarmName } from './naming.js';
import type { CloudWatchAlarmProps, CloudWatchDashboardResourceProps } from './types.js';

const createDefaultDashboardWidgets = (
  props: CloudWatchAlarmProps,
  alarm: CloudWatchDashboardResourceProps['alarm'],
): readonly IWidget[] => {
  const alarmName = resolveAlarmName(props) ?? 'Alarm';

  return [
    new AlarmWidget({
      title: alarmName,
      alarm,
      ...props.alarmWidgetOverrides,
    }),
    new GraphWidget({
      title: `${alarmName} metric`,
      left: [props.metric],
      ...props.graphWidgetOverrides,
    }),
  ];
};

export const resolveDashboardName = (props: CloudWatchAlarmProps): string | undefined => {
  const alarmName = resolveAlarmName(props);

  return props.dashboardName ?? (alarmName ? `${alarmName}-dashboard` : undefined);
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
