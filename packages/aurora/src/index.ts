export type AuroraEngineFamily = 'aurora-postgresql' | 'aurora-mysql';

export interface AuroraPackageInfo {
  readonly packageName: '@cdk-construct/aurora';
  readonly supportedEngines: readonly AuroraEngineFamily[];
}

export const auroraPackageInfo: AuroraPackageInfo = {
  packageName: '@cdk-construct/aurora',
  supportedEngines: ['aurora-postgresql', 'aurora-mysql'],
};
