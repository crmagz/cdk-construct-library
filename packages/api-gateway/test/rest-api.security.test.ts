import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { MockIntegration } from 'aws-cdk-lib/aws-apigateway';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { IConstruct } from 'constructs';

import { ApiGatewayRestApi } from '../src/index.js';

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

describe('ApiGatewayRestApi security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'ApiGatewayRestApiSecurityStack');

    const api = new ApiGatewayRestApi(stack, 'OrdersApi', {
      env: prodEnv,
      apiName: 'orders-api',
    });
    const method = api.api.root.addMethod(
      'GET',
      new MockIntegration({
        integrationResponses: [{ statusCode: '200' }],
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
      }),
      {
        methodResponses: [{ statusCode: '200' }],
        requestValidator: api.requestValidator,
      },
    );
    const cloudWatchRoleResource = api.api.node.tryFindChild('CloudWatchRole')?.node.defaultChild;
    const methodResource = method.node.defaultChild;
    const stageResource = api.api.deploymentStage.node.defaultChild;

    if (!cloudWatchRoleResource || !methodResource || !stageResource) {
      throw new Error('Expected API Gateway security fixture resources to be synthesized.');
    }

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

    expect(() => app.synth()).not.toThrow();
  });
});
