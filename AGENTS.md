# Repository Development Standards

These instructions apply to this repository in addition to the global Codex
standards.

## Public API Style

- Prefer exported `type` aliases for public props, config objects, helper inputs,
  and helper outputs.
- Prefer unions and intersections for consumer extension points.
- Use `interface` only when declaration merging or class implementation contracts
  are intentionally required.
- Use const-backed objects for runtime constants that also need exported types.

## Environment Config

- Shared environment primitives belong in `@cdk-construct/core`.
- Use `EnvironmentConfig` for app and stack props:

```ts
type AppEnvironment = EnvironmentConfig & {
  readonly s3: Omit<S3BucketProps, 'env'>;
};
```

- Environment-aware constructs must receive `env` intentionally. Do not silently
  default to production or non-production in core helpers.
- If a package chooses a default, the package must do so explicitly and document
  the behavior.
- Use `account` and `region` as optional strings so consumers can model their AWS
  accounts and regions without library-owned account IDs or region enums.

## App Documentation Pattern

Package documentation should show consumers how to structure CDK apps:

1. Define environment-specific construct props in `bin/environments.ts`.
2. Use an array named `environments`.
3. Compose `EnvironmentConfig` with service-specific props using intersections.
4. Keep service props nested by package name, such as `s3`, `sqs`, or `aurora`.
5. Pass selected environment objects into stacks.
6. In `bin/app.ts`, synthesize stacks with `environments.forEach(...)`.
7. In stack constructors, compose the final construct props inline.

Preferred shape:

```ts
// bin/environments.ts
export const environments: AppEnvironment[] = [
  {
    env: {
      name: EnvironmentName.PROD,
      account: '333333333333',
      region: 'us-east-1',
    },
    s3: {
      bucketName: 'app-assets-prod',
    },
  },
];
```

```ts
// src/storage-stack.ts
new S3Bucket(this, 'Assets', {
  env: props.env,
  ...props.s3,
});
```

```ts
// bin/app.ts
environments.forEach((environment) => {
  new StorageStack(app, `storage-${environment.env.name}`, environment);
});
```

Avoid examples that create multiple construct calls for dev/staging/prod when
one stack can receive environment-specific props.

## Project Boundaries

- Do not mention or copy private company names, package names, account IDs,
  domains, subnet IDs, or other private identifiers from reference repositories.
- Reference repositories may inform structure and patterns only.
- Keep examples OSS-safe and use placeholder AWS account IDs.
