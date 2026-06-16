import { EnvironmentName } from '@cdk-construct/core';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  EndpointType,
  IpAddressType,
  MockIntegration,
  RequestValidator,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import { ApiGatewayRestApi, createApiGatewayRestApi } from '../src/index.js';
import type { ApiGatewayRestApiProps } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const devEnv = {
  name: EnvironmentName.DEV,
  account: '123456789012',
  region: 'us-east-1',
};

const synthesizeRestApi = (api: ApiGatewayRestApi): Template => {
  return Template.fromStack(Stack.of(api));
};

const addMockGetMethod = (api: RestApi, requestValidator: RequestValidator): void => {
  api.root.addMethod(
    'GET',
    new MockIntegration({
      integrationResponses: [{ statusCode: '200' }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [{ statusCode: '200' }],
      requestValidator,
    },
  );
};

describe('ApiGatewayRestApi', () => {
  it('creates a production REST API with operational defaults', () => {
    const stack = new Stack();
    const api = new ApiGatewayRestApi(stack, 'OrdersApi', {
      env: prodEnv,
      apiName: 'orders-api',
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::ApiGateway::Stage', 1);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'orders-api',
      EndpointConfiguration: {
        Types: ['REGIONAL'],
      },
    });
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'AWS_IAM',
      HttpMethod: 'GET',
      RequestValidatorId: {
        Ref: Match.stringLikeRegexp('ResourceRequestValidator'),
      },
    });
    template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
      Name: 'orders-api-default-validator',
      ValidateRequestBody: true,
      ValidateRequestParameters: true,
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/orders-api/prod',
      RetentionInDays: 365,
    });
    template.hasResource('AWS::Logs::LogGroup', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'prod',
      TracingEnabled: true,
      AccessLogSetting: {
        DestinationArn: {
          'Fn::GetAtt': [Match.stringLikeRegexp('ResourceAccessLogs'), 'Arn'],
        },
        Format: Match.serializedJson(
          Match.objectLike({
            requestId: '$context.requestId',
            httpMethod: '$context.httpMethod',
            status: '$context.status',
          }),
        ),
      },
      MethodSettings: [
        {
          DataTraceEnabled: false,
          HttpMethod: '*',
          LoggingLevel: 'INFO',
          MetricsEnabled: true,
          ResourcePath: '/*',
          ThrottlingBurstLimit: 1000,
          ThrottlingRateLimit: 500,
        },
      ],
    });
  });

  it('uses non-production log lifecycle and throttling defaults', () => {
    const stack = new Stack();
    const api = new ApiGatewayRestApi(stack, 'DevApi', {
      env: devEnv,
      apiName: 'orders-api-dev',
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/orders-api-dev/dev',
      RetentionInDays: 30,
    });
    template.hasResource('AWS::Logs::LogGroup', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'dev',
      MethodSettings: [
        Match.objectLike({
          ThrottlingBurstLimit: 200,
          ThrottlingRateLimit: 100,
        }),
      ],
    });
  });

  it('supports direct CDK overrides', () => {
    const stack = new Stack();
    const api = new ApiGatewayRestApi(stack, 'InternalApi', {
      env: devEnv,
      apiName: 'internal-api',
      description: 'Internal API',
      stageName: 'sandbox',
      logRetention: RetentionDays.ONE_WEEK,
      logRemovalPolicy: RemovalPolicy.RETAIN,
      throttlingBurstLimit: 25,
      throttlingRateLimit: 10,
      restApiOverrides: {
        defaultMethodOptions: {
          apiKeyRequired: true,
        },
        endpointConfiguration: {
          types: [EndpointType.PRIVATE],
        },
        disableExecuteApiEndpoint: true,
      },
      accessLogGroupOverrides: {
        logGroupName: '/custom/api/access',
      },
      deployOptions: {
        tracingEnabled: false,
      },
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'internal-api',
      Description: 'Internal API',
      DisableExecuteApiEndpoint: true,
      EndpointConfiguration: {
        Types: ['PRIVATE'],
      },
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/custom/api/access',
      RetentionInDays: 7,
    });
    template.hasResource('AWS::Logs::LogGroup', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'sandbox',
      TracingEnabled: false,
      MethodSettings: [
        Match.objectLike({
          ThrottlingBurstLimit: 25,
          ThrottlingRateLimit: 10,
        }),
      ],
    });
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'AWS_IAM',
      ApiKeyRequired: true,
    });
  });

  it('merges endpoint configuration overrides with the regional default', () => {
    const stack = new Stack();
    const api = new ApiGatewayRestApi(stack, 'DualStackApi', {
      env: devEnv,
      apiName: 'dual-stack-api',
      restApiOverrides: {
        endpointConfiguration: {
          ipAddressType: IpAddressType.DUAL_STACK,
        },
      },
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'dual-stack-api',
      EndpointConfiguration: {
        IpAddressType: 'dualstack',
        Types: ['REGIONAL'],
      },
    });
  });

  it('ignores deployOptions stageName in favor of the dedicated stageName prop', () => {
    const stack = new Stack();
    const api = new ApiGatewayRestApi(stack, 'StageApi', {
      env: devEnv,
      apiName: 'stage-api',
      stageName: 'sandbox',
      deployOptions: {
        stageName: 'unsafe-deploy-stage',
        tracingEnabled: false,
      },
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/stage-api/sandbox',
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'sandbox',
      TracingEnabled: false,
    });
  });

  it('ignores construct-owned restApiOverrides keys from unsafe callers', () => {
    const stack = new Stack();
    const unsafeRestApiOverrides = {
      restApiName: 'unsafe-api-name',
      description: 'Unsafe description',
      deployOptions: {
        stageName: 'unsafe-stage',
        tracingEnabled: false,
        metricsEnabled: false,
        throttlingBurstLimit: 9_999,
        throttlingRateLimit: 9_999,
      },
      defaultMethodOptions: {
        apiKeyRequired: true,
      },
      disableExecuteApiEndpoint: true,
    } as unknown as ApiGatewayRestApiProps['restApiOverrides'];
    const api = new ApiGatewayRestApi(stack, 'SafeOverridesApi', {
      env: devEnv,
      apiName: 'owned-api-name',
      description: 'Owned description',
      restApiOverrides: unsafeRestApiOverrides,
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeRestApi(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'owned-api-name',
      Description: 'Owned description',
      DisableExecuteApiEndpoint: true,
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'dev',
      TracingEnabled: true,
      MethodSettings: [
        Match.objectLike({
          MetricsEnabled: true,
          ThrottlingBurstLimit: 200,
          ThrottlingRateLimit: 100,
        }),
      ],
    });
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'AWS_IAM',
      ApiKeyRequired: true,
    });
  });

  it('returns resources from the functional factory', () => {
    const stack = new Stack();
    const resources = createApiGatewayRestApi(stack, 'FactoryApi', {
      env: prodEnv,
      apiName: 'factory-api',
    });

    expect(resources.api).toBeDefined();
    expect(resources.accessLogGroup).toBeDefined();
    expect(resources.requestValidator).toBeDefined();
  });
});
