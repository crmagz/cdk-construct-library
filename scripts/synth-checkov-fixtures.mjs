import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EnvironmentName } from '@cdk-construct/core';
import { S3Bucket } from '@cdk-construct/s3';
import { SqsQueue } from '@cdk-construct/sqs';
import { App, Stack } from 'aws-cdk-lib';
import { QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';

const outputDirectory = '.checkov/cfn';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const writeTemplate = async (fileName, template) => {
  await writeFile(join(outputDirectory, fileName), `${JSON.stringify(template, null, 2)}\n`);
};

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const app = new App();

const s3Stack = new Stack(app, 'CheckovS3Fixture');
const accessLogsBucket = new Bucket(s3Stack, 'AccessLogs', {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  encryption: BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  versioned: true,
});
accessLogsBucket.node.defaultChild.cfnOptions.metadata = {
  checkov: {
    skip: [
      {
        id: 'CKV_AWS_18',
        comment:
          'This bucket receives S3 server access logs; logging this bucket would create recursive log delivery.',
      },
    ],
  },
};

new S3Bucket(s3Stack, 'Assets', {
  env: prodEnv,
  bucketName: 'checkov-assets-prod',
  bucketOverrides: {
    serverAccessLogsBucket: accessLogsBucket,
    serverAccessLogsPrefix: 'assets/',
  },
});

const sqsStack = new Stack(app, 'CheckovSqsFixture');

new SqsQueue(sqsStack, 'Orders', {
  env: prodEnv,
  queueName: 'checkov-orders-prod',
  queueOverrides: {
    encryption: QueueEncryption.KMS_MANAGED,
  },
  deadLetterQueueOverrides: {
    encryption: QueueEncryption.KMS_MANAGED,
  },
});

const assembly = app.synth();

await writeTemplate('s3.template.json', assembly.getStackByName(s3Stack.stackName).template);
await writeTemplate('sqs.template.json', assembly.getStackByName(sqsStack.stackName).template);
