import type { BedrockPackageInfo } from './types.js';

export const bedrockPackageInfo: BedrockPackageInfo = {
  packageName: '@cdk-construct/bedrock',
  service: 'Amazon Bedrock',
};

export * from './credential-provider.js';
export * from './environment.js';
export * from './gateway-target.js';
export * from './gateway.js';
export * from './runtime.js';
export * from './tags.js';
export * from './types.js';
