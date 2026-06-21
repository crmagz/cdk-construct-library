import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { IConstruct } from 'constructs';

import {
  ApiGatewayVpcEndpoint,
  PrivateApiGatewayRestApi,
  RegionalApiGatewayRestApi,
} from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const createSecurityApp = (): App => {
  const app = new App();
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return app;
};

const createHandler = (stack: Stack, id = 'Handler'): Function => {
  return new Function(stack, id, {
    runtime: Runtime.NODEJS_LATEST,
    handler: 'index.handler',
    code: Code.fromInline(`
      exports.handler = async () => ({
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      });
    `),
  });
};

const acknowledgeNagFinding = (construct: IConstruct, id: string, reason: string): void => {
  try {
    Validations.of(construct).acknowledge({
      id,
      reason,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid validation rule ID')) {
      // cdk-nag granular IDs contain reserved "::" delimiters that CDK 2.258 rejects.
      construct.node.addMetadata(Validations.ACKNOWLEDGED_RULES_METADATA_KEY, {
        [`annotation::${id}`]: reason,
      });
      return;
    }

    throw error;
  }
};

const acknowledgeApiGatewayFindings = (
  api: RegionalApiGatewayRestApi | PrivateApiGatewayRestApi,
): void => {
  const cloudWatchRoleResource = api.api.node.tryFindChild('CloudWatchRole')?.node.defaultChild;
  const restApiResource = api.api.node.defaultChild;
  const stageResource = api.api.deploymentStage.node.defaultChild;
  const methodResource = api.proxyResource.node.tryFindChild('ANY')?.node.defaultChild;

  if (!cloudWatchRoleResource || !restApiResource || !stageResource || !methodResource) {
    throw new Error('Expected API Gateway security fixture resources to be synthesized.');
  }

  acknowledgeNagFinding(
    restApiResource,
    'AwsSolutions-APIG2',
    'The construct intentionally uses a Lambda proxy integration; request validation is owned by the Lambda application framework.',
  );
  acknowledgeNagFinding(
    stageResource,
    'AwsSolutions-APIG3',
    'WAF association is workload-specific and is intentionally left to the consuming stack.',
  );
  acknowledgeNagFinding(
    methodResource,
    'AwsSolutions-COG4',
    'The construct defaults methods to IAM auth; Cognito auth is workload-specific.',
  );
  acknowledgeNagFinding(
    cloudWatchRoleResource,
    'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs]',
    'API Gateway requires the AWS managed CloudWatch Logs service-role policy for execution logging.',
  );
};

const acknowledgeHandlerFindings = (handler: Function): void => {
  const functionResource = handler.node.defaultChild;
  const role = handler.role?.node.defaultChild;

  if (!functionResource || !role) {
    throw new Error('Expected Lambda handler role to be synthesized.');
  }

  acknowledgeNagFinding(
    functionResource,
    'AwsSolutions-L1',
    'The fixture Lambda only exercises the proxy integration; handler runtime selection is owned by the consuming stack.',
  );
  acknowledgeNagFinding(
    role,
    'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
    'The fixture Lambda uses the AWS managed basic execution policy; handler roles are owned by the consuming stack.',
  );
};

describe('API Gateway security', () => {
  it('passes AWS Solutions checks for the regional production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'RegionalApiGatewayRestApiSecurityStack');
    const handler = createHandler(stack);

    const api = new RegionalApiGatewayRestApi(stack, 'OrdersApi', {
      env: prodEnv,
      apiName: 'orders-api',
      handler,
    });

    acknowledgeApiGatewayFindings(api);
    acknowledgeHandlerFindings(handler);

    expect(() => app.synth()).not.toThrow();
  });

  it('passes AWS Solutions checks for the private production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'PrivateApiGatewayRestApiSecurityStack');
    const handler = createHandler(stack);
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
    const endpoint = new ApiGatewayVpcEndpoint(stack, 'ApiEndpoint', {
      vpc,
      allowedCidrs: ['10.0.0.0/24'],
    });
    const api = new PrivateApiGatewayRestApi(stack, 'OrdersApi', {
      env: prodEnv,
      apiName: 'orders-private-api',
      handler,
      vpcEndpoints: [endpoint.endpoint],
    });

    acknowledgeNagFinding(
      vpc.node.defaultChild,
      'AwsSolutions-VPC7',
      'The fixture VPC exists only to synthesize the endpoint helper; flow logs are owned by the consuming network stack.',
    );
    acknowledgeApiGatewayFindings(api);
    acknowledgeHandlerFindings(handler);

    expect(() => app.synth()).not.toThrow();
  });
});
