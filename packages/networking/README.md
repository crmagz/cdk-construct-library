# @cdk-construct/networking

Networking constructs for AWS CDK with secure VPC defaults, subnet layout helpers, and transit gateway primitives.

## Install

```sh
npm install @cdk-construct/networking @cdk-construct/core
```

## Quick Start

```ts
import { Stack } from 'aws-cdk-lib';
import { EnvironmentName } from '@cdk-construct/core';
import { networkingPackageName } from '@cdk-construct/networking';

const stack = new Stack();

console.log(networkingPackageName, EnvironmentName.PROD, stack.stackName);
```

## Defaults

- Provides environment-aware networking constructs.
- Keeps CDK escape hatches explicit through typed override props.
- Exposes package APIs from ESM-compatible TypeScript sources.

## Documentation

- [Networking package](./docs/networking.md)
