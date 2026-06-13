export { EnvironmentName } from '@cdk-construct/core';
export type {
  AwsAccountId,
  AwsRegion,
  DeploymentEnvironment,
  EnvironmentAwareProps,
  EnvironmentConfig,
  EnvironmentInput,
  EnvironmentNameLike,
} from '@cdk-construct/core';
export {
  ApiGatewayRestApi,
  createApiGatewayRestApi,
  createApiGatewayRestApiResources,
  createRestApiAccessLogGroupResource,
  createRestApiRequestValidatorResource,
  createRestApiResource,
} from './rest-api.js';
export type {
  ApiGatewayRestApiDefaults,
  ApiGatewayRestApiProps,
  ApiGatewayRestApiResources,
  CreateApiGatewayRestApiResourceProps,
  RestApiAccessLogGroupResourceProps,
  RestApiRequestValidatorResourceProps,
  RestApiResourceProps,
} from './types.js';
