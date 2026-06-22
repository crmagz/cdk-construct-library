export interface EksPackageInfo {
  readonly packageName: '@cdk-construct/eks';
  readonly service: 'Amazon EKS';
  readonly releasePreview: boolean;
}

export const eksPackageInfo: EksPackageInfo = {
  packageName: '@cdk-construct/eks',
  service: 'Amazon EKS',
  releasePreview: true,
};
