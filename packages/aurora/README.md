# @cdk-construct/aurora

Aurora PostgreSQL and Aurora MySQL cluster constructs for AWS CDK.

## Install

```sh
npm install @cdk-construct/aurora
```

## Usage

```ts
import { EnvironmentName } from '@cdk-construct/core';
import { AuroraCluster, AuroraEngineFamily } from '@cdk-construct/aurora';
import { Stack } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

const stack = new Stack();
const vpc = Vpc.fromLookup(stack, 'Vpc', { isDefault: false });

new AuroraCluster(stack, 'OrdersDatabase', {
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  clusterIdentifier: 'orders-prod',
  engine: AuroraEngineFamily.POSTGRESQL,
  vpc,
  defaultDatabaseName: 'orders',
  credentials: {
    mode: 'secret',
    username: 'postgres',
    secretName: 'orders/prod/master',
  },
});
```

The construct creates a decoupled Secrets Manager database secret and passes it
to the RDS cluster through dynamic references. Raw password strings are not part
of the public API.

## Defaults

- Private isolated subnet placement unless `vpcSubnets` is provided.
- Encrypted cluster storage.
- Production environments enable deletion protection, retain the cluster, keep
  seven days of automated backups, and add one reader.
- Non-production environments use one writer, one day of automated backups, no
  deletion protection, and snapshot retention on removal.
- CloudWatch log exports are enabled by default for supported engine log types.
- IAM database authentication is enabled when `credentials.mode` is `iam`.

## Documentation

- [Aurora cluster](./docs/cluster.md)
