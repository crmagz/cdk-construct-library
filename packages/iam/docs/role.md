# IRSA Role

`IrsaRole` creates an IAM role for an EKS Kubernetes service account using an
OIDC federated trust policy.

## Usage

Keep role properties in environment configuration and pass the selected props
through the stack.

`bin/environments.ts`

```ts
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EnvironmentName, type EnvironmentConfig } from '@cdk-construct/core';
import { type IrsaRoleProps } from '@cdk-construct/iam';

type WorkloadEnvironment = EnvironmentConfig & {
  readonly iam: Omit<IrsaRoleProps, 'env'>;
};

export const environments: WorkloadEnvironment[] = [
  {
    env: {
      name: EnvironmentName.DEV,
      account: '111111111111',
      region: 'us-east-1',
    },
    iam: {
      namespace: 'orders',
      serviceAccountName: 'orders-api',
      oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/DEV',
      policyStatements: [
        new PolicyStatement({
          sid: 'SendDevOrdersMessages',
          effect: Effect.ALLOW,
          actions: ['sqs:SendMessage'],
          resources: ['arn:aws:sqs:us-east-1:111111111111:orders-dev'],
        }),
      ],
    },
  },
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    iam: {
      namespace: 'orders',
      serviceAccountName: 'orders-api',
      oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/PROD',
      roleName: 'orders-api-prod',
      policyStatements: [
        new PolicyStatement({
          sid: 'SendProdOrdersMessages',
          effect: Effect.ALLOW,
          actions: ['sqs:SendMessage'],
          resources: ['arn:aws:sqs:us-east-1:333333333333:orders-prod'],
        }),
      ],
    },
  },
];
```

`src/workload-stack.ts`

```ts
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type EnvironmentConfig, resolveAwsEnvironment } from '@cdk-construct/core';
import { IrsaRole, type IrsaRoleProps } from '@cdk-construct/iam';

type WorkloadStackProps = StackProps &
  EnvironmentConfig & {
    readonly iam: Omit<IrsaRoleProps, 'env'>;
  };

export class WorkloadStack extends Stack {
  public constructor(scope: Construct, id: string, props: WorkloadStackProps) {
    super(scope, id, {
      env: resolveAwsEnvironment(props),
    });

    new IrsaRole(this, 'OrdersRole', {
      env: props.env,
      ...props.iam,
    });
  }
}
```

`bin/app.ts`

```ts
import { App } from 'aws-cdk-lib';
import { environments } from './environments.js';
import { WorkloadStack } from '../src/workload-stack.js';

const app = new App();

environments.forEach((environment) => {
  new WorkloadStack(app, `workload-${environment.env.name}`, environment);
});
```

## Trust Policy

`oidcProviderUrl` may include or omit `https://`. The construct trims it,
removes trailing slashes, and rejects `http://` before generating the provider
ARN and condition keys. `env.account` is required because the OIDC provider ARN
is account-scoped. The ARN uses the stack partition so the construct can
synthesize correctly outside the commercial AWS partition.

`namespace` and `serviceAccountName` are trimmed before the `sub` condition is
generated. Empty values are rejected.

The generated trust policy allows only:

- `sts:AssumeRoleWithWebIdentity`
- `aud` equal to `sts.amazonaws.com`
- `sub` equal to `system:serviceaccount:<namespace>:<serviceAccountName>`

## Permissions

No permissions are granted by default. Add only the policy statements or managed
policies required by the workload.

Policy statements are validated before they are attached to the role. The
default validator rejects:

- missing statement Sids
- duplicate statement Sids
- wildcard actions such as `*`, `s3:*`, or `iam:*AccessKey*`
- `Resource: "*"` without an explicit exception
- `NotAction`
- `NotResource`
- any `Principal` element because statements are attached as identity-based role
  policies
- wildcard principals
- account root principals

Some AWS APIs require `Resource: "*"`. Keep those exceptions explicit and
document the reason at the call site.

```ts
new IrsaRole(this, 'OrdersRole', {
  env: props.env,
  namespace: 'orders',
  serviceAccountName: 'orders-api',
  oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/PROD',
  policyStatements: [
    new PolicyStatement({
      sid: 'CreateApplicationLogGroup',
      effect: Effect.ALLOW,
      actions: ['logs:CreateLogGroup'],
      resources: ['*'],
    }),
  ],
  policyValidation: {
    allowWildcardResources: [
      {
        value: '*',
        reason: 'CloudWatch Logs CreateLogGroup requires wildcard resources.',
      },
    ],
  },
});
```

The IRSA trust principal is owned by the construct. `roleOverrides` cannot
replace the OIDC federated trust policy, which prevents accidental trust of
account root or wildcard principals.

## Escape Hatch

Use `roleOverrides` for CDK `RoleProps` not modeled directly by this package.
Trust policy and inline policy overrides are intentionally not supported.

```ts
new IrsaRole(this, 'OrdersRole', {
  env: props.env,
  namespace: 'orders',
  serviceAccountName: 'orders-api',
  oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/PROD',
  roleOverrides: {
    description: 'IRSA role for the orders workload',
  },
});
```
