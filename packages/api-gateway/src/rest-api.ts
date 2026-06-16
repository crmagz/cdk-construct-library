import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RequestValidator,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import type {
  EndpointConfiguration,
  MethodOptions,
  RestApiProps,
  StageOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import type {
  ApiGatewayRestApiDefaults,
  ApiGatewayRestApiProps,
  ApiGatewayRestApiResources,
  CreateApiGatewayRestApiResourceProps,
  RestApiAccessLogGroupResourceProps,
  RestApiRequestValidatorResourceProps,
  RestApiResourceProps,
  RestApiOverrides,
} from './types.js';

const DEFAULT_PROD_LOG_RETENTION = RetentionDays.ONE_YEAR;
const DEFAULT_NON_PROD_LOG_RETENTION = RetentionDays.ONE_MONTH;
const DEFAULT_PROD_THROTTLING_BURST_LIMIT = 1_000;
const DEFAULT_NON_PROD_THROTTLING_BURST_LIMIT = 200;
const DEFAULT_PROD_THROTTLING_RATE_LIMIT = 500;
const DEFAULT_NON_PROD_THROTTLING_RATE_LIMIT = 100;

const defaultsForEnvironment = (props: ApiGatewayRestApiProps): ApiGatewayRestApiDefaults => {
  const environment = resolveEnvironmentConfig(props);
  const production = isProductionEnvironment(environment);

  return {
    stageName: environment.name,
    logRetention: production ? DEFAULT_PROD_LOG_RETENTION : DEFAULT_NON_PROD_LOG_RETENTION,
    logRemovalPolicy: production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    tracingEnabled: true,
    metricsEnabled: true,
    throttlingBurstLimit: production
      ? DEFAULT_PROD_THROTTLING_BURST_LIMIT
      : DEFAULT_NON_PROD_THROTTLING_BURST_LIMIT,
    throttlingRateLimit: production
      ? DEFAULT_PROD_THROTTLING_RATE_LIMIT
      : DEFAULT_NON_PROD_THROTTLING_RATE_LIMIT,
  };
};

const resolveStageName = (
  props: ApiGatewayRestApiProps,
  defaults: ApiGatewayRestApiDefaults,
): string => {
  return props.stageName ?? defaults.stageName;
};

const resolveAccessLogGroupName = (
  props: ApiGatewayRestApiProps,
  defaults: ApiGatewayRestApiDefaults,
): string => {
  return (
    props.accessLogGroupName ??
    `/aws/apigateway/${props.apiName}/${resolveStageName(props, defaults)}`
  );
};

const createAccessLogFormat = (props: ApiGatewayRestApiProps): AccessLogFormat => {
  return (
    props.accessLogFormat ??
    AccessLogFormat.jsonWithStandardFields({
      caller: false,
      httpMethod: true,
      ip: true,
      protocol: true,
      requestTime: true,
      resourcePath: true,
      responseLength: true,
      status: true,
      user: true,
    })
  );
};

const sanitizeDeployOptions = (
  deployOptions: ApiGatewayRestApiProps['deployOptions'],
): ApiGatewayRestApiProps['deployOptions'] => {
  if (!deployOptions) {
    return undefined;
  }

  const safeDeployOptions = { ...deployOptions };
  delete safeDeployOptions.stageName;

  return safeDeployOptions;
};

const createDeployOptions = (
  props: ApiGatewayRestApiProps,
  defaults: ApiGatewayRestApiDefaults,
  accessLogGroup: ILogGroup,
): StageOptions => {
  return {
    stageName: resolveStageName(props, defaults),
    accessLogDestination: new LogGroupLogDestination(accessLogGroup),
    accessLogFormat: createAccessLogFormat(props),
    tracingEnabled: props.tracingEnabled ?? defaults.tracingEnabled,
    metricsEnabled: props.metricsEnabled ?? defaults.metricsEnabled,
    loggingLevel: MethodLoggingLevel.INFO,
    dataTraceEnabled: false,
    throttlingBurstLimit: props.throttlingBurstLimit ?? defaults.throttlingBurstLimit,
    throttlingRateLimit: props.throttlingRateLimit ?? defaults.throttlingRateLimit,
    ...sanitizeDeployOptions(props.deployOptions),
  };
};

const createDefaultMethodOptions = (props: ApiGatewayRestApiProps): MethodOptions => {
  return {
    authorizationType: AuthorizationType.IAM,
    ...props.restApiOverrides?.defaultMethodOptions,
  };
};

const createEndpointConfiguration = (props: ApiGatewayRestApiProps): EndpointConfiguration => {
  return {
    types: [EndpointType.REGIONAL],
    ...props.restApiOverrides?.endpointConfiguration,
  };
};

type UnsafeRestApiOverrides = RestApiOverrides &
  Partial<Pick<RestApiProps, 'deployOptions' | 'description' | 'restApiName'>>;

const sanitizeRestApiOverrides = (
  overrides: ApiGatewayRestApiProps['restApiOverrides'],
): RestApiOverrides | undefined => {
  if (!overrides) {
    return undefined;
  }

  const safeOverrides = { ...(overrides as UnsafeRestApiOverrides) };
  delete safeOverrides.deployOptions;
  delete safeOverrides.description;
  delete safeOverrides.restApiName;

  return safeOverrides;
};

export class ApiGatewayRestApi extends Construct {
  public readonly api: RestApi;
  public readonly accessLogGroup: LogGroup;
  public readonly requestValidator: RequestValidator;

  public constructor(scope: Construct, id: string, props: ApiGatewayRestApiProps) {
    super(scope, id);

    const resources = createApiGatewayRestApiResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.api = resources.api;
    this.accessLogGroup = resources.accessLogGroup;
    this.requestValidator = resources.requestValidator;
  }
}

export const createRestApiAccessLogGroupResource = (
  resourceProps: RestApiAccessLogGroupResourceProps,
): LogGroup => {
  const { scope, id, props, defaults } = resourceProps;

  return new LogGroup(scope, `${id}AccessLogs`, {
    logGroupName: resolveAccessLogGroupName(props, defaults),
    retention: props.logRetention ?? defaults.logRetention,
    removalPolicy: props.logRemovalPolicy ?? defaults.logRemovalPolicy,
    ...props.accessLogGroupOverrides,
  });
};

export const createRestApiResource = (resourceProps: RestApiResourceProps): RestApi => {
  const { scope, id, props, defaults, accessLogGroup } = resourceProps;

  return new RestApi(scope, `${id}Api`, {
    ...sanitizeRestApiOverrides(props.restApiOverrides),
    restApiName: props.apiName,
    description: props.description,
    cloudWatchRole: true,
    deployOptions: createDeployOptions(props, defaults, accessLogGroup),
    defaultMethodOptions: createDefaultMethodOptions(props),
    endpointConfiguration: createEndpointConfiguration(props),
  });
};

export const createRestApiRequestValidatorResource = (
  resourceProps: RestApiRequestValidatorResourceProps,
): RequestValidator => {
  const { scope, id, api } = resourceProps;

  return new RequestValidator(scope, `${id}RequestValidator`, {
    restApi: api,
    requestValidatorName: `${api.restApiName}-default-validator`,
    validateRequestBody: true,
    validateRequestParameters: true,
  });
};

export const createApiGatewayRestApiResources = (
  resourceProps: CreateApiGatewayRestApiResourceProps,
): ApiGatewayRestApiResources => {
  const defaults = defaultsForEnvironment(resourceProps.props);
  const accessLogGroup = createRestApiAccessLogGroupResource({
    ...resourceProps,
    defaults,
  });
  const api = createRestApiResource({
    ...resourceProps,
    defaults,
    accessLogGroup,
  });
  const requestValidator = createRestApiRequestValidatorResource({
    ...resourceProps,
    defaults,
    api,
  });

  return { api, accessLogGroup, requestValidator };
};

export const createApiGatewayRestApi = (
  scope: Construct,
  id: string,
  props: ApiGatewayRestApiProps,
): ApiGatewayRestApiResources => {
  const restApi = new ApiGatewayRestApi(scope, id, props);

  return {
    api: restApi.api,
    accessLogGroup: restApi.accessLogGroup,
    requestValidator: restApi.requestValidator,
  };
};
