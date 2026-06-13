# Security Tooling

This repository uses CDK-native security validation and synthesized template scanning during construct development.

## Current Standard

- `cdk-nag` runs AWS Solutions checks against CDK fixture stacks.
- `Checkov` scans synthesized CloudFormation fixtures for supported construct packages.
- `npm run security` runs both `cdk-nag` and Checkov checks.
- `npm run security:cdk-nag` runs only CDK-native security tests.
- `npm run security:checkov` compiles workspace packages, synthesizes CloudFormation fixtures into `.checkov/cfn`, and runs Checkov.
- `npm test` and `npm run build` also run `*.security.test.ts` files through normal Jest discovery, so pull requests are validated in CI.
- Lefthook runs `npm run format:check`, `npm run security:cdk-nag`, and `npm run security:checkov` before commits.

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

For local Checkov runs, install either:

- `checkov==3.3.1`
- `uvx`, which lets the project run the pinned Checkov version without a global Checkov install

CI installs the pinned Checkov version with Python before running `npm run security`.

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

## Checkov Fixture Pattern

Each construct package that synthesizes AWS resources should add a secure fixture to `scripts/synth-checkov-fixtures.mjs`. The fixture should represent the package's production posture and should be scanned as synthesized CloudFormation, not source TypeScript.

Checkov does not inspect TypeScript construct implementation directly. The fixture script compiles the workspace packages, imports the actual package exports, instantiates representative constructs, synthesizes their CloudFormation templates, and scans those templates.

Use Checkov suppressions only for narrowly scoped scanner limitations or intentional supporting resources. Prefer fixing the fixture or construct defaults first.

For CDK resource-level suppressions, add CloudFormation metadata through the L1 construct:

```ts
const cfnResource = resource.node.defaultChild;
cfnResource.cfnOptions.metadata = {
  checkov: {
    skip: [
      {
        id: 'CKV_AWS_18',
        comment: 'Explain the exact exception.',
      },
    ],
  },
};
```

## Terraform And Other IaC

For Terraform or cross-IaC scanning, standardize on Checkov as the broad IaC scanner. For CDK packages, keep `cdk-nag` because it validates CDK constructs directly before synthesized templates are handed to broader scanners.
