import { Tags } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';

import { resolveEnvironmentName } from './environment.js';
import type { EnvironmentInput } from './environment.js';

export type TagMap = Readonly<Record<string, string>>;

export type TaggedProps = {
  readonly tags?: TagMap;
};

export type StandardTagsProps = {
  readonly env?: EnvironmentInput;
  readonly application?: string;
  readonly owner?: string;
  readonly costCenter?: string;
  readonly additionalTags?: TagMap;
};

export const standardTags = (props: StandardTagsProps = {}): TagMap => {
  const tags: Record<string, string> = {};

  if (props.env !== undefined) {
    tags.Environment = resolveEnvironmentName(props.env);
  }

  if (props.application !== undefined) {
    tags.Application = props.application;
  }

  if (props.owner !== undefined) {
    tags.Owner = props.owner;
  }

  if (props.costCenter !== undefined) {
    tags.CostCenter = props.costCenter;
  }

  return {
    ...tags,
    ...props.additionalTags,
  };
};

export const applyTags = (construct: IConstruct, tags?: TagMap): void => {
  Object.entries(tags ?? {}).forEach(([key, value]) => {
    Tags.of(construct).add(key, value);
  });
};
