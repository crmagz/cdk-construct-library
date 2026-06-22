export type EksPackageInfo = {
  readonly packageName: '@cdk-construct/eks';
  readonly service: string;
  readonly releasePreview: boolean;
  readonly releaseNoteFormat: 'conventional-commits';
};

export const eksPackageInfo: EksPackageInfo = Object.freeze({
  packageName: '@cdk-construct/eks',
  service: 'Amazon Elastic Kubernetes Service',
  releasePreview: true,
  releaseNoteFormat: 'conventional-commits',
});
