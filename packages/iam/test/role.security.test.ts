import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AwsSolutionsChecks } from 'cdk-nag';

import { IrsaRole } from '../src/index.js';

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

describe('IrsaRole security', () => {
  it('passes AWS Solutions checks for a least-privilege production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'IrsaRoleSecurityStack');

    new IrsaRole(stack, 'OrdersRole', {
      env: prodEnv,
      namespace: 'orders',
      serviceAccountName: 'orders-api',
      oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
      policyStatements: [
        new PolicyStatement({
          sid: 'SendOrdersMessages',
          effect: Effect.ALLOW,
          actions: ['sqs:SendMessage'],
          resources: ['arn:aws:sqs:us-east-1:123456789012:orders'],
        }),
      ],
    });

    expect(() => app.synth()).not.toThrow();
  });
});
