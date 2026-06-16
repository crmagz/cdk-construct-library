import type { CloudWatchAlarmProps } from './types.js';

export const resolveAlarmName = (props: CloudWatchAlarmProps): string | undefined => {
  if (props.alarmOverrides && Object.hasOwn(props.alarmOverrides, 'alarmName')) {
    return props.alarmOverrides.alarmName;
  }

  return props.alarmName;
};
