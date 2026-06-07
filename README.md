# CDK Construct Library

`@cdk-construct/library` is the foundation for paved-road AWS CDK constructs:
opinionated building blocks that make the common path easy while keeping
advanced configuration available through explicit escape hatches.

The library is built with projen, TypeScript 5.9.3, ESLint, GTS, Prettier, and
ESM package metadata.

## Install

```sh
npm install @cdk-construct/library
```

## Project Status

This initial package establishes the publishing, formatting, linting, and build
foundation for the construct library. The project goal is to provide constructs
with safe defaults, environment-aware cost controls, and opt-in overrides for
teams that need to step outside the paved path.

## Commands

- `npm run lint`
- `npm run format`
- `npm run build`
- `npm run clean`
- `npm run deploy`

`npm run deploy` builds the package and publishes the generated tarball from
`dist/js` to NPM.
