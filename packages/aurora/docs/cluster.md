# Aurora Cluster

`AuroraCluster` creates a foundational Aurora PostgreSQL or Aurora MySQL cluster
with environment-aware defaults and explicit CDK escape hatches.

## Secret-backed credentials

```ts
new AuroraCluster(this, 'OrdersPostgres', {
  env: {
    name: 'prod',
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

The construct returns both `cluster` and `secret`. The secret can also be
imported by ARN or attributes:

```ts
const resources = new AuroraCluster(this, 'OrdersPostgres', {
  env: { name: 'prod' },
  clusterIdentifier: 'orders-prod',
  engine: AuroraEngineFamily.POSTGRESQL,
  vpc,
  credentials: {
    mode: 'secret',
    username: 'postgres',
    secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:orders/prod/master-AbCdEf',
  },
});

resources.secret?.grantRead(appRole);
```

## IAM database authentication

```ts
new AuroraCluster(this, 'OrdersMysql', {
  env: { name: 'prod' },
  clusterIdentifier: 'orders-mysql-prod',
  engine: AuroraEngineFamily.MYSQL,
  vpc,
  credentials: {
    mode: 'iam',
    username: 'admin',
    secretName: 'orders/prod/bootstrap',
  },
});
```

Aurora still requires bootstrap master credentials when IAM database
authentication is enabled. The construct generates those credentials in Secrets
Manager and enables `EnableIAMDatabaseAuthentication` on the cluster.

## Overrides

Use typed props for common settings and `clusterOverrides` or `secretOverrides`
for advanced CDK options:

```ts
new AuroraCluster(this, 'OrdersDatabase', {
  env: { name: 'dev' },
  clusterIdentifier: 'orders-dev',
  engine: AuroraEngineFamily.POSTGRESQL,
  vpc,
  credentials: {
    mode: 'secret',
    username: 'postgres',
  },
  backup: {
    retention: Duration.days(3),
  },
  clusterOverrides: {
    preferredMaintenanceWindow: 'Sun:23:45-Mon:00:15',
  },
});
```

The construct rejects overrides for core fields it owns, such as `credentials`,
`engine`, `vpc`, `writer`, and `readers`.
