import type { EnvironmentAwareProps } from '@cdk-construct/core';

export const validateBedrockEnvironmentConfig = (props: EnvironmentAwareProps): void => {
  if (props.env?.name === undefined) {
    throw new Error(
      'Environment config is required. Pass props.env with at least an environment name.',
    );
  }
};
