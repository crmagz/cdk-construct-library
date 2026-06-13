# Security Tooling

This repository uses CDK-native security validation during construct development.

## Current Standard

- `cdk-nag` runs AWS Solutions checks against CDK fixture stacks.
- `npm run security` runs security-focused Jest tests.
- `npm test` and `npm run build` also run `*.security.test.ts` files through normal Jest discovery, so pull requests are validated in CI.
- Lefthook runs `npm run format:check` and `npm run security` before commits.

Install local hooks after cloning:

```sh
npm install
```

The `prepare` script runs `lefthook install`. To reinstall hooks manually:

```sh
npm run hooks:install
```

To run the hook without committing:

```sh
npm run hooks:run
```

## Why Lefthook

Lefthook is the preferred hook runner for this project because it is language-neutral and works well across TypeScript, Python, Go, and mixed repositories. Husky is a solid option for JavaScript-only repositories, but it makes Node package lifecycle scripts the primary hook control plane. This repository still uses npm to install Lefthook, but the hook configuration itself remains portable.

## CDK Construct Pattern

Each construct package should add security fixture tests when it introduces AWS resources.

Use cdk-nag acknowledgements only for narrowly scoped exceptions with explicit reasons. Prefer fixing construct defaults or fixture configuration before acknowledging a rule.

Example:

```ts
import { App, Stack, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

const stack = new Stack(app, 'SecurityStack');

// Add construct fixtures here.

app.synth();
```

## Terraform And Other IaC

For Terraform or cross-IaC scanning, standardize on Checkov as the broad IaC scanner. For CDK packages, keep `cdk-nag` because it validates CDK constructs directly before synthesized templates are handed to broader scanners.
