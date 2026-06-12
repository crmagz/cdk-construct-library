import { EnvironmentName } from '@cdk-construct/core';

/**
 * @deprecated Use `EnvironmentName` from `@cdk-construct/core`.
 */
export const BucketEnvironment = {
  DEVELOPMENT: EnvironmentName.DEV,
  STAGING: EnvironmentName.STAGING,
  PRODUCTION: EnvironmentName.PROD,
} as const;

/**
 * @deprecated Use `EnvironmentName` from `@cdk-construct/core`.
 */
export type BucketEnvironment = (typeof BucketEnvironment)[keyof typeof BucketEnvironment];

export enum StorageCostStrategy {
  NONE = 'none',
  INFREQUENT_ACCESS = 'infrequent-access',
  INTELLIGENT_TIERING = 'intelligent-tiering',
  INTELLIGENT_TIERING_ARCHIVE = 'intelligent-tiering-archive',
  ARCHIVE = 'archive',
}
