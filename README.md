# CDK Construct Library

This repository is the `@cdk-construct` monorepo for paved-road AWS CDK
constructs: opinionated building blocks that make the common path easy while
keeping advanced configuration available through explicit escape hatches.

The project is built with projen, npm workspaces, TypeScript 5.9.3, ESLint, GTS,
Prettier, and ESM package metadata.

## Packages

| Package               | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `@cdk-construct/core` | Shared foundation for future service constructs |

## Install

```sh
npm install @cdk-construct/core
```

## Project Status

The first workspace release focuses on `@cdk-construct/core`. Service packages
will be added independently as the public APIs settle, with package-specific
versions, tags, and release notes.

Releases are curated from conventional commits. Package-scoped commits such as
`feat(core): add environment helpers` tell the release story without requiring
verbose manual notes.

## Commands

- `npm run lint`
- `npm run format`
- `npm run build`
- `npm run clean`
- `npm run deploy`

`npm run deploy` builds the package and publishes the generated tarball from
`dist/js` to NPM.
