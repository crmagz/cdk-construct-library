import { isProductionEnvironment, resolveEnvironmentConfig } from '@cdk-construct/core';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  IpAddressType,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import type {
  EndpointConfiguration,
  MethodOptions,
  Resource,
  RestApiProps,
  StageOptions,
} from 'aws-cdk-lib/aws-apigateway';
import {
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointAwsService,
  Peer,
  Port,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import type { IVpcEndpoint } from 'aws-cdk-lib/aws-ec2';
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import type {
  ApiGatewayRestApiDefaults,
  ApiGatewayRestApiBaseProps,
  ApiGatewayRestApiResources,
  ApiGatewayVpcEndpointProps,
  ApiGatewayVpcEndpointResources,
  CreateApiGatewayRestApiResourceProps,
  PrivateApiGatewayRestApiProps,
  RegionalApiGatewayRestApiProps,
  RestApiAccessLogGroupResourceProps,
  RestApiProxyResourceProps,
  RestApiResourceProps,
  RestApiOverrides,
} from './types.js';

const DEFAULT_PROD_LOG_RETENTION = RetentionDays.ONE_YEAR;
const DEFAULT_NON_PROD_LOG_RETENTION = RetentionDays.ONE_MONTH;
const DEFAULT_PROD_THROTTLING_BURST_LIMIT = 1_000;
const DEFAULT_NON_PROD_THROTTLING_BURST_LIMIT = 200;
const DEFAULT_PROD_THROTTLING_RATE_LIMIT = 500;
const DEFAULT_NON_PROD_THROTTLING_RATE_LIMIT = 100;

const defaultsForEnvironment = (props: ApiGatewayRestApiBaseProps): ApiGatewayRestApiDefaults => {
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
  props: ApiGatewayRestApiBaseProps,
  defaults: ApiGatewayRestApiDefaults,
): string => {
  return props.stageName ?? defaults.stageName;
};

const resolveAccessLogGroupName = (
  props: ApiGatewayRestApiBaseProps,
  defaults: ApiGatewayRestApiDefaults,
): string => {
  return (
    props.accessLogGroupName ??
    `/aws/apigateway/${props.apiName}/${resolveStageName(props, defaults)}`
  );
};

const createAccessLogFormat = (props: ApiGatewayRestApiBaseProps): AccessLogFormat => {
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
  deployOptions: ApiGatewayRestApiBaseProps['deployOptions'],
): ApiGatewayRestApiBaseProps['deployOptions'] => {
  if (!deployOptions) {
    return undefined;
  }

  const safeDeployOptions = { ...deployOptions };
  delete safeDeployOptions.stageName;

  return safeDeployOptions;
};

const createDeployOptions = (
  props: ApiGatewayRestApiBaseProps,
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

const createDefaultMethodOptions = (props: ApiGatewayRestApiBaseProps): MethodOptions => {
  return {
    authorizationType: AuthorizationType.IAM,
    ...props.proxyMethodOptions,
  };
};

const createRegionalEndpointConfiguration = (
  props: RegionalApiGatewayRestApiProps,
): EndpointConfiguration => {
  return {
    types: [EndpointType.REGIONAL],
    ipAddressType: props.ipAddressType,
  };
};

type UnsafeRestApiOverrides = RestApiOverrides &
  Partial<
    Pick<
      RestApiProps,
      | 'defaultIntegration'
      | 'defaultMethodOptions'
      | 'deployOptions'
      | 'description'
      | 'endpointConfiguration'
      | 'restApiName'
    >
  >;

const sanitizeRestApiOverrides = (
  overrides: ApiGatewayRestApiBaseProps['restApiOverrides'],
): RestApiOverrides | undefined => {
  if (!overrides) {
    return undefined;
  }

  const safeOverrides = { ...(overrides as UnsafeRestApiOverrides) };
  delete safeOverrides.defaultIntegration;
  delete safeOverrides.defaultMethodOptions;
  delete safeOverrides.deployOptions;
  delete safeOverrides.description;
  delete safeOverrides.endpointConfiguration;
  delete safeOverrides.restApiName;

  return safeOverrides;
};

const importVpcEndpoints = (
  scope: Construct,
  endpointIds: readonly string[] | undefined,
): readonly IVpcEndpoint[] => {
  return (endpointIds ?? []).map((vpcEndpointId, index) =>
    InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(scope, `ImportedVpcEndpoint${index}`, {
      port: 443,
      vpcEndpointId,
    }),
  );
};

const resolvePrivateVpcEndpoints = (
  scope: Construct,
  props: PrivateApiGatewayRestApiProps,
): readonly IVpcEndpoint[] => {
  const endpoints = [
    ...(props.vpcEndpoints ?? []),
    ...importVpcEndpoints(scope, props.vpcEndpointIds),
  ];

  if (endpoints.length === 0) {
    throw new Error('Private API Gateway REST APIs require at least one VPC endpoint.');
  }

  return endpoints;
};

const resolveSourceVpcEndpointIds = (
  endpoints: readonly IVpcEndpoint[],
  props: PrivateApiGatewayRestApiProps,
): readonly string[] => {
  const endpointIds =
    props.sourceVpcEndpointIds ?? endpoints.map((endpoint) => endpoint.vpcEndpointId);

  if (endpointIds.length === 0) {
    throw new Error('Private API Gateway REST APIs require at least one source VPC endpoint ID.');
  }

  return endpointIds;
};

const createPrivateEndpointConfiguration = (
  endpoints: readonly IVpcEndpoint[],
  props: PrivateApiGatewayRestApiProps,
): EndpointConfiguration => {
  return {
    types: [EndpointType.PRIVATE],
    ipAddressType: props.ipAddressType ?? IpAddressType.DUAL_STACK,
    vpcEndpoints: [...endpoints],
  };
};

const createPrivateApiResourcePolicy = (
  sourceVpcEndpointIds: readonly string[],
): PolicyDocument => {
  return new PolicyDocument({
    assignSids: true,
    statements: [
      new PolicyStatement({
        sid: 'AllowInvokeFromVpcEndpoints',
        effect: Effect.ALLOW,
        principals: [new AnyPrincipal()],
        actions: ['execute-api:Invoke'],
        resources: ['execute-api:/*'],
        conditions: {
          StringEquals: {
            'aws:SourceVpce': [...sourceVpcEndpointIds],
          },
        },
      }),
    ],
  });
};

export class RegionalApiGatewayRestApi extends Construct {
  public readonly api: RestApi;
  public readonly accessLogGroup: LogGroup;
  public readonly proxyResource: Resource;

  public constructor(scope: Construct, id: string, props: RegionalApiGatewayRestApiProps) {
    super(scope, id);

    const resources = createApiGatewayRestApiResources({
      scope: this,
      id: 'Resource',
      props,
      endpointConfiguration: createRegionalEndpointConfiguration(props),
    });

    this.api = resources.api;
    this.accessLogGroup = resources.accessLogGroup;
    this.proxyResource = resources.proxyResource;
  }
}

export class PrivateApiGatewayRestApi extends Construct {
  public readonly api: RestApi;
  public readonly accessLogGroup: LogGroup;
  public readonly proxyResource: Resource;
  public readonly vpcEndpoints: readonly IVpcEndpoint[];

  public constructor(scope: Construct, id: string, props: PrivateApiGatewayRestApiProps) {
    super(scope, id);

    this.vpcEndpoints = resolvePrivateVpcEndpoints(this, props);

    const resources = createApiGatewayRestApiResources({
      scope: this,
      id: 'Resource',
      props,
      endpointConfiguration: createPrivateEndpointConfiguration(this.vpcEndpoints, props),
      policy: createPrivateApiResourcePolicy(resolveSourceVpcEndpointIds(this.vpcEndpoints, props)),
    });

    this.api = resources.api;
    this.accessLogGroup = resources.accessLogGroup;
    this.proxyResource = resources.proxyResource;
  }
}

export class ApiGatewayVpcEndpoint extends Construct {
  public readonly endpoint: IVpcEndpoint;
  public readonly securityGroup: SecurityGroup;

  public constructor(scope: Construct, id: string, props: ApiGatewayVpcEndpointProps) {
    super(scope, id);

    const resources = createApiGatewayVpcEndpointResources({
      scope: this,
      id: 'Resource',
      props,
    });

    this.endpoint = resources.endpoint;
    this.securityGroup = resources.securityGroup;
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
  const { scope, id, props, defaults, accessLogGroup, endpointConfiguration, policy } =
    resourceProps;

  return new RestApi(scope, `${id}Api`, {
    ...sanitizeRestApiOverrides(props.restApiOverrides),
    restApiName: props.apiName,
    description: props.description,
    cloudWatchRole: true,
    deployOptions: createDeployOptions(props, defaults, accessLogGroup),
    endpointConfiguration,
    policy,
  });
};

export const createRestApiProxyResource = (resourceProps: RestApiProxyResourceProps): Resource => {
  const { props, api } = resourceProps;
  const integration = new LambdaIntegration(props.handler, {
    proxy: true,
    ...props.proxyIntegrationOptions,
  });
  const proxyResource = api.root.addResource('{proxy+}');

  proxyResource.addMethod('ANY', integration, createDefaultMethodOptions(props));

  return proxyResource;
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
  const proxyResource = createRestApiProxyResource({
    ...resourceProps,
    defaults,
    api,
  });

  return { api, accessLogGroup, proxyResource };
};

export const createRegionalApiGatewayRestApi = (
  scope: Construct,
  id: string,
  props: RegionalApiGatewayRestApiProps,
): ApiGatewayRestApiResources => {
  const restApi = new RegionalApiGatewayRestApi(scope, id, props);

  return {
    api: restApi.api,
    accessLogGroup: restApi.accessLogGroup,
    proxyResource: restApi.proxyResource,
  };
};

export const createPrivateApiGatewayRestApi = (
  scope: Construct,
  id: string,
  props: PrivateApiGatewayRestApiProps,
): ApiGatewayRestApiResources => {
  const restApi = new PrivateApiGatewayRestApi(scope, id, props);

  return {
    api: restApi.api,
    accessLogGroup: restApi.accessLogGroup,
    proxyResource: restApi.proxyResource,
  };
};

export const createApiGatewayVpcEndpointResources = (resourceProps: {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ApiGatewayVpcEndpointProps;
}): ApiGatewayVpcEndpointResources => {
  const { scope, id, props } = resourceProps;
  const securityGroup = new SecurityGroup(scope, `${id}SecurityGroup`, {
    allowAllOutbound: false,
    description: props.securityGroupDescription ?? 'Security group for API Gateway VPC endpoint',
    securityGroupName: props.securityGroupName,
    vpc: props.vpc,
    ...props.securityGroupOverrides,
  });

  for (const cidr of props.allowedCidrs ?? []) {
    securityGroup.addIngressRule(Peer.ipv4(cidr), Port.tcp(443), 'Allow HTTPS from API clients');
  }

  const endpoint = new InterfaceVpcEndpoint(scope, `${id}Endpoint`, {
    service: InterfaceVpcEndpointAwsService.APIGATEWAY,
    open: false,
    privateDnsEnabled: props.privateDnsEnabled ?? false,
    securityGroups: [securityGroup],
    subnets: props.subnets,
    vpc: props.vpc,
    ...props.endpointOverrides,
  });

  return { endpoint, securityGroup };
};

export const createApiGatewayVpcEndpoint = (
  scope: Construct,
  id: string,
  props: ApiGatewayVpcEndpointProps,
): ApiGatewayVpcEndpointResources => {
  const endpoint = new ApiGatewayVpcEndpoint(scope, id, props);

  return {
    endpoint: endpoint.endpoint,
    securityGroup: endpoint.securityGroup,
  };
};
