# CDK Construct Library

This repository is the `@cdk-construct` monorepo for paved-road AWS CDK
constructs: opinionated building blocks that make the common path easy while
keeping advanced configuration available through explicit escape hatches.

The project is built with projen, npm workspaces, TypeScript 5.9.3, ESLint, GTS,
Prettier, and ESM package metadata.

## Packages

| Package                     | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `@cdk-construct/core`       | Shared foundation for future service constructs |
| `@cdk-construct/aurora`     | Aurora PostgreSQL and MySQL constructs          |
| `@cdk-construct/s3`         | S3 bucket constructs                            |
| `@cdk-construct/sqs`        | SQS queue constructs                            |
| `@cdk-construct/iam`        | IAM role constructs                             |
| `@cdk-construct/cloudfront` | CloudFront distribution constructs              |

## Install

```sh
npm install @cdk-construct/core
```

## Releases

Releases are inferred from Conventional Commits on `main`. The release workflow
checks each workspace path independently, calculates the next semantic version,
publishes the package to npm, and creates a service-prefixed GitHub release tag:

```text
s3/v0.1.0
core/v0.1.0
cloudfront/v0.1.0
```

Use package scopes in commit subjects, for example
`feat(s3): add bucket construct` or `feat(cloudfront): add distribution construct`.

## Commands

- `npm run lint`
- `npm run format`
- `npm run build`
- `npm run clean`
- `npm run deploy`

`npm run deploy` runs the same package release script used by CI.

See [Release Process](docs/release-process.md) and
[NPM Publishing](docs/npm-publishing.md) for release and trusted publishing
setup.
