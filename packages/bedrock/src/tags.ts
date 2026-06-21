import { standardTags } from '@cdk-construct/core';
import type { CfnTag } from 'aws-cdk-lib';

import type { BedrockTaggableProps } from './types.js';

export const bedrockTags = (props: BedrockTaggableProps): Record<string, string> => {
  return standardTags({
    env: props.env,
    additionalTags: props.tags,
  });
};

export const bedrockCfnTags = (props: BedrockTaggableProps): CfnTag[] => {
  return Object.entries(bedrockTags(props)).map(([key, value]) => ({
    key,
    value,
  }));
};
