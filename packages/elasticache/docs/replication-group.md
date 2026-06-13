# ElastiCache Replication Group

`ElastiCacheReplicationGroup` creates a Redis OSS or Valkey replication group
with the supporting VPC subnet group, cache security group, and Redis AUTH token
secret.

```ts
import { EnvironmentName } from '@cdk-construct/core';
import { ElastiCacheReplicationGroup } from '@cdk-construct/elasticache';
import { Stack } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

const stack = new Stack();
const vpc = new Vpc(stack, 'Vpc');

new ElastiCacheReplicationGroup(stack, 'OrdersCache', {
  env: {
    name: EnvironmentName.PROD,
    account: '123456789012',
    region: 'us-east-1',
  },
  replicationGroupId: 'orders-cache-prod',
  vpc,
  vpcSubnets: {
    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
  },
});
```

Production defaults use two cache nodes, automatic failover, Multi-AZ,
encryption at rest, required in-transit encryption, Redis AUTH, a non-default
port, and 15 days of automatic snapshot retention. Non-production defaults use a
single smaller cache node and one day of snapshot retention.

Use `replicationGroupOverrides`, `subnetGroupOverrides`, and
`securityGroupOverrides` when you need direct CDK or CloudFormation escape hatch
control.
