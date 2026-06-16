import { EnvironmentName } from '@cdk-construct/core';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  IpAddressType,
  MockIntegration,
  RequestValidator,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import {
  ApiGatewayVpcEndpoint,
  PrivateApiGatewayRestApi,
  RegionalApiGatewayRestApi,
  createApiGatewayVpcEndpoint,
  createPrivateApiGatewayRestApi,
  createRegionalApiGatewayRestApi,
} from '../src/index.js';
import type { RegionalApiGatewayRestApiProps } from '../src/index.js';

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

const synthesizeConstruct = (
  construct: RegionalApiGatewayRestApi | PrivateApiGatewayRestApi,
): Template => {
  return Template.fromStack(Stack.of(construct));
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

describe('RegionalApiGatewayRestApi', () => {
  it('creates a production REST API with operational defaults', () => {
    const stack = new Stack();
    const api = new RegionalApiGatewayRestApi(stack, 'OrdersApi', {
      env: prodEnv,
      apiName: 'orders-api',
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
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
    const api = new RegionalApiGatewayRestApi(stack, 'DevApi', {
      env: devEnv,
      apiName: 'orders-api-dev',
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
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

  it('supports direct CDK overrides without allowing endpoint type changes', () => {
    const stack = new Stack();
    const api = new RegionalApiGatewayRestApi(stack, 'InternalApi', {
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

    const template = synthesizeConstruct(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'internal-api',
      Description: 'Internal API',
      DisableExecuteApiEndpoint: true,
      EndpointConfiguration: {
        Types: ['REGIONAL'],
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

  it('sets dual-stack endpoint support with the dedicated prop', () => {
    const stack = new Stack();
    const api = new RegionalApiGatewayRestApi(stack, 'DualStackApi', {
      env: devEnv,
      apiName: 'dual-stack-api',
      ipAddressType: IpAddressType.DUAL_STACK,
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
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
    const api = new RegionalApiGatewayRestApi(stack, 'StageApi', {
      env: devEnv,
      apiName: 'stage-api',
      stageName: 'sandbox',
      deployOptions: {
        stageName: 'unsafe-deploy-stage',
        tracingEnabled: false,
      },
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
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
      endpointConfiguration: {
        types: ['EDGE'],
      },
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
    } as unknown as RegionalApiGatewayRestApiProps['restApiOverrides'];
    const api = new RegionalApiGatewayRestApi(stack, 'SafeOverridesApi', {
      env: devEnv,
      apiName: 'owned-api-name',
      description: 'Owned description',
      restApiOverrides: unsafeRestApiOverrides,
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'owned-api-name',
      Description: 'Owned description',
      DisableExecuteApiEndpoint: true,
      EndpointConfiguration: {
        Types: ['REGIONAL'],
      },
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

  it('returns resources from the regional functional factory', () => {
    const stack = new Stack();
    const resources = createRegionalApiGatewayRestApi(stack, 'FactoryApi', {
      env: prodEnv,
      apiName: 'factory-api',
    });

    expect(resources.api).toBeDefined();
    expect(resources.accessLogGroup).toBeDefined();
    expect(resources.requestValidator).toBeDefined();
  });
});

describe('PrivateApiGatewayRestApi', () => {
  it('creates a private REST API restricted to VPC endpoint source IDs', () => {
    const stack = new Stack();
    const api = new PrivateApiGatewayRestApi(stack, 'PrivateOrdersApi', {
      env: prodEnv,
      apiName: 'orders-private-api',
      vpcEndpointIds: ['vpce-0123456789abcdef0'],
    });
    addMockGetMethod(api.api, api.requestValidator);

    const template = synthesizeConstruct(api);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'orders-private-api',
      EndpointConfiguration: {
        IpAddressType: 'dualstack',
        Types: ['PRIVATE'],
        VpcEndpointIds: ['vpce-0123456789abcdef0'],
      },
      Policy: {
        Statement: [
          Match.objectLike({
            Sid: 'AllowInvokeFromVpcEndpoints',
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Principal: {
              AWS: '*',
            },
            Resource: 'execute-api:/*',
            Condition: {
              StringEquals: {
                'aws:SourceVpce': ['vpce-0123456789abcdef0'],
              },
            },
          }),
        ],
      },
    });
  });

  it('requires at least one VPC endpoint', () => {
    const stack = new Stack();

    expect(
      () =>
        new PrivateApiGatewayRestApi(stack, 'MissingEndpointApi', {
          env: devEnv,
          apiName: 'missing-endpoint-api',
        }),
    ).toThrow('Private API Gateway REST APIs require at least one VPC endpoint.');
  });

  it('returns resources from the private functional factory', () => {
    const stack = new Stack();
    const resources = createPrivateApiGatewayRestApi(stack, 'FactoryPrivateApi', {
      env: prodEnv,
      apiName: 'factory-private-api',
      vpcEndpointIds: ['vpce-0123456789abcdef0'],
    });

    expect(resources.api).toBeDefined();
    expect(resources.accessLogGroup).toBeDefined();
    expect(resources.requestValidator).toBeDefined();
  });
});

describe('ApiGatewayVpcEndpoint', () => {
  it('creates an API Gateway interface endpoint with explicit client ingress', () => {
    const stack = new Stack();
    const vpc = new Vpc(stack, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Private',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    const endpoint = new ApiGatewayVpcEndpoint(stack, 'ApiGatewayEndpoint', {
      vpc,
      allowedCidrs: ['10.0.0.0/24'],
    });

    expect(endpoint.endpoint).toBeDefined();
    expect(endpoint.securityGroup).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      PrivateDnsEnabled: false,
      ServiceName: {
        'Fn::Join': [
          '',
          [
            'com.amazonaws.',
            {
              Ref: 'AWS::Region',
            },
            '.execute-api',
          ],
        ],
      },
      VpcEndpointType: 'Interface',
    });
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: [
        Match.objectLike({
          CidrIp: '10.0.0.0/24',
          FromPort: 443,
          IpProtocol: 'tcp',
          ToPort: 443,
        }),
      ],
    });
  });

  it('returns resources from the endpoint functional factory', () => {
    const stack = new Stack();
    const vpc = new Vpc(stack, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Private',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    const resources = createApiGatewayVpcEndpoint(stack, 'FactoryEndpoint', {
      vpc,
      allowedCidrs: ['10.0.1.0/24'],
    });

    expect(resources.endpoint).toBeDefined();
    expect(resources.securityGroup).toBeDefined();
  });
});
