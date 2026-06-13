import { EnvironmentName } from '@cdk-construct/core';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { AwsSolutionsChecks } from 'cdk-nag';

import { S3Bucket } from '../src/index.js';

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

describe('S3Bucket security', () => {
  it('passes AWS Solutions checks for the production fixture', () => {
    const app = createSecurityApp();
    const stack = new Stack(app, 'S3BucketSecurityStack');
    const accessLogsBucket = new Bucket(stack, 'AccessLogs', {
      enforceSSL: true,
    });

    Validations.of(accessLogsBucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason:
        'This bucket receives S3 server access logs; logging this bucket would create recursive log delivery.',
    });

    new S3Bucket(stack, 'Assets', {
      env: prodEnv,
      bucketName: 'security-assets-prod',
      bucketOverrides: {
        serverAccessLogsBucket: accessLogsBucket,
        serverAccessLogsPrefix: 'assets/',
      },
    });

    expect(() => app.synth()).not.toThrow();
  });
});
