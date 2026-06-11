# CDK Construct Library

This repository is the `@cdk-construct` monorepo for paved-road AWS CDK
constructs: opinionated building blocks that make the common path easy while
keeping advanced configuration available through explicit escape hatches.

The project is built with projen, npm workspaces, TypeScript 5.9.3, ESLint, GTS,
Prettier, and ESM package metadata.

## Packages

| Package                 | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `@cdk-construct/core`   | Shared foundation for future service constructs |
| `@cdk-construct/aurora` | Aurora PostgreSQL and MySQL constructs          |
| `@cdk-construct/s3`     | S3 bucket constructs                            |

## Install

```sh
npm install @cdk-construct/core
```

## Releases

Releases are managed with Changesets. Add a changeset in feature and fix PRs
when a published workspace package should receive a version bump:

```sh
npm run changeset
```

The release workflow opens a release PR with the selected package versions and
publishes changed packages from `.github/workflows/release.yml` after that PR is
merged.

## Commands

- `npm run lint`
- `npm run format`
- `npm run build`
- `npm run clean`
- `npm run changeset`
- `npm run deploy`

`npm run deploy` builds the workspaces and publishes changed packages through
Changesets.

See [Release Process](docs/release-process.md) and
[NPM Publishing](docs/npm-publishing.md) for release and trusted publishing
setup.
