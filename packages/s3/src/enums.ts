export enum BucketEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum StorageCostStrategy {
  NONE = 'none',
  INFREQUENT_ACCESS = 'infrequent-access',
  INTELLIGENT_TIERING = 'intelligent-tiering',
  INTELLIGENT_TIERING_ARCHIVE = 'intelligent-tiering-archive',
  ARCHIVE = 'archive',
}
