import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type { RemovalPolicy } from 'aws-cdk-lib';
import type {
  AccessLogFormat,
  RequestValidator,
  RestApi,
  RestApiProps,
  StageOptions,
} from 'aws-cdk-lib/aws-apigateway';
import type { ILogGroup, LogGroup, LogGroupProps, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export type ApiGatewayRestApiProps = EnvironmentAwareProps & {
  readonly apiName: string;
  readonly description?: string;
  readonly stageName?: string;
  readonly accessLogGroupName?: string;
  readonly accessLogFormat?: AccessLogFormat;
  readonly tracingEnabled?: boolean;
  readonly metricsEnabled?: boolean;
  readonly throttlingBurstLimit?: number;
  readonly throttlingRateLimit?: number;
  readonly logRetention?: RetentionDays;
  readonly logRemovalPolicy?: RemovalPolicy;
  readonly deployOptions?: CdkOverrides<StageOptions>;
  readonly restApiOverrides?: CdkOverrides<RestApiProps>;
  readonly accessLogGroupOverrides?: CdkOverrides<LogGroupProps>;
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
  readonly requestValidator: RequestValidator;
};

export type RestApiAccessLogGroupResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ApiGatewayRestApiProps;
  readonly defaults: ApiGatewayRestApiDefaults;
};

export type RestApiResourceProps = RestApiAccessLogGroupResourceProps & {
  readonly accessLogGroup: ILogGroup;
};

export type RestApiRequestValidatorResourceProps = RestApiAccessLogGroupResourceProps & {
  readonly api: RestApi;
};

export type CreateApiGatewayRestApiResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: ApiGatewayRestApiProps;
};
