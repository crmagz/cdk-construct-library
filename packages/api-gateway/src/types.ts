import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type { RemovalPolicy } from 'aws-cdk-lib';
import type {
  AccessLogFormat,
  EndpointConfiguration,
  IpAddressType,
  LambdaIntegrationOptions,
  MethodOptions,
  Resource,
  RestApi,
  RestApiProps,
  StageOptions,
} from 'aws-cdk-lib/aws-apigateway';
import type {
  InterfaceVpcEndpointProps,
  IVpc,
  IVpcEndpoint,
  SecurityGroup,
  SecurityGroupProps,
  SubnetSelection,
} from 'aws-cdk-lib/aws-ec2';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import type { ILogGroup, LogGroup, LogGroupProps, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { PolicyDocument } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

type ConstructOwnedRestApiOverrideKey =
  | 'defaultIntegration'
  | 'defaultMethodOptions'
  | 'deployOptions'
  | 'description'
  | 'endpointConfiguration'
  | 'restApiName';

export type RestApiOverrides = Omit<CdkOverrides<RestApiProps>, ConstructOwnedRestApiOverrideKey>;

export type ApiGatewayRestApiBaseProps = EnvironmentAwareProps & {
  readonly apiName: string;
  readonly handler: IFunction;
  readonly description?: string;
  readonly stageName?: string;
  readonly ipAddressType?: IpAddressType;
  readonly accessLogGroupName?: string;
  readonly accessLogFormat?: AccessLogFormat;
  readonly tracingEnabled?: boolean;
  readonly metricsEnabled?: boolean;
  readonly throttlingBurstLimit?: number;
  readonly throttlingRateLimit?: number;
  readonly logRetention?: RetentionDays;
  readonly logRemovalPolicy?: RemovalPolicy;
  readonly deployOptions?: CdkOverrides<StageOptions>;
  readonly proxyIntegrationOptions?: CdkOverrides<LambdaIntegrationOptions>;
  readonly proxyMethodOptions?: CdkOverrides<MethodOptions>;
  readonly restApiOverrides?: RestApiOverrides;
  readonly accessLogGroupOverrides?: CdkOverrides<LogGroupProps>;
};

export type RegionalApiGatewayRestApiProps = ApiGatewayRestApiBaseProps;

export type PrivateApiGatewayRestApiProps = ApiGatewayRestApiBaseProps & {
  readonly vpcEndpoints?: readonly IVpcEndpoint[];
  readonly vpcEndpointIds?: readonly string[];
  readonly sourceVpcEndpointIds?: readonly string[];
};

export type ApiGatewayRestApiDefaults = {
  readonly stageName: string;
  readonly logRetention: RetentionDays;
  readonly logRemovalPolicy: RemovalPolicy;
  readonly tracingEnabled: boolean;
  readonly metricsEnabled: boolean;
  readonly throttlingBurstLimit: number;
  readonly throttlingRateLimit: number;
};

export type ApiGatewayRestApiResources = {
  readonly api: RestApi;
  readonly accessLogGroup: LogGroup;
  readonly proxyResource: Resource;
};

export type ApiGatewayVpcEndpointProps = {
  readonly vpc: IVpc;
  readonly allowedCidrs?: readonly string[];
  readonly privateDnsEnabled?: boolean;
  readonly subnets?: SubnetSelection;
  readonly securityGroupDescription?: string;
  readonly securityGroupName?: string;
  readonly securityGroupOverrides?: CdkOverrides<Omit<SecurityGroupProps, 'vpc'>>;
  readonly endpointOverrides?: CdkOverrides<
    Omit<
      InterfaceVpcEndpointProps,
      'open' | 'privateDnsEnabled' | 'securityGroups' | 'service' | 'subnets' | 'vpc'
    >
  >;
};

export type ApiGatewayVpcEndpointResources = {
  readonly endpoint: IVpcEndpoint;
  readonly securityGroup: SecurityGroup;
};

export type RestApiAccessLogGroupResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ApiGatewayRestApiBaseProps;
  readonly defaults: ApiGatewayRestApiDefaults;
};

export type RestApiResourceProps = RestApiAccessLogGroupResourceProps & {
  readonly accessLogGroup: ILogGroup;
  readonly endpointConfiguration: EndpointConfiguration;
  readonly policy?: PolicyDocument;
};

export type RestApiProxyResourceProps = RestApiAccessLogGroupResourceProps & {
  readonly api: RestApi;
};

export type CreateApiGatewayRestApiResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ApiGatewayRestApiBaseProps;
  readonly endpointConfiguration: EndpointConfiguration;
  readonly policy?: PolicyDocument;
};
