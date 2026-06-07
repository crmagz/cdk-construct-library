import { JsonPatch, TextFile, javascript, typescript } from 'projen';

const project = new typescript.TypeScriptProject({
  name: '@cdk-construct/library',
  packageName: '@cdk-construct/library',
  description: 'AWS CDK construct library',
  authorName: 'Cristian Magana',
  authorEmail: '33166233+cristianmagana@users.noreply.github.com',
  repository: 'git@github.com:crmagz/cdk-construct-library.git',
  defaultReleaseBranch: 'main',
  packageManager: javascript.NodePackageManager.NPM,

  minNodeVersion: '20.0.0',
  workflowNodeVersion: '20.x',

  projenrcTs: true,
  sampleCode: false,
  releaseToNpm: true,
  pullRequestTemplateContents: [
    '<!--',
    'PR Title Format: <type>(<scope>): <description>',
    'Example: feat(s3): add bucket construct',
    '',
    'Types: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert',
    'Breaking change: Add ! after type, e.g., feat!(api): redesign construct props',
    '-->',
    '',
    '## Related Issue',
    '',
    '<!-- Example: Resolves #123 -->',
    '',
    'Resolves:',
    '',
    '## Type of Change',
    '',
    '- [ ] Feature (new functionality)',
    '- [ ] Bug fix (non-breaking fix)',
    '- [ ] Refactor (no functional change)',
    '- [ ] Performance improvement',
    '- [ ] Documentation update',
    '- [ ] Infrastructure / CI / Build',
    '- [ ] Breaking change',
    '',
    '## Summary',
    '',
    "<!-- What problem does this solve? What's the motivation? -->",
    '',
    '## What Changed',
    '',
    '<!-- What did you change and why this approach? What alternatives did you consider? -->',
    '',
    '## How You Tested',
    '',
    '<!-- Unit tests? Integration tests? Manual validation? Include commands or steps. -->',
    '',
    '- [ ] Tests added/updated in `test/`',
    '- [ ] `npm run lint`',
    '- [ ] `npm run format:check`',
    '- [ ] `npm run build`',
    '',
    '## Checklist',
    '',
    '- [ ] PR title follows conventional commit format',
    '- [ ] Self-reviewed my own code',
    '- [ ] Docs updated (if behavior changed)',
    '- [ ] No new warnings generated',
  ],

  typescriptVersion: '5.9.3',
  eslint: false,
  prettier: true,
  prettierOptions: {
    settings: {
      semi: true,
      singleQuote: true,
      trailingComma: javascript.TrailingComma.ALL,
      printWidth: 100,
      tabWidth: 2,
    },
  },

  peerDeps: ['aws-cdk-lib@^2.236.0', 'constructs@^10.4.0'],
  devDeps: [
    'eslint@^9.37.0',
    'aws-cdk-lib@2.236.0',
    'constructs@10.4.0',
    'gts@^7.0.0',
    'prettier@^3.8.1',
  ],
  keywords: ['aws-cdk', 'cdk', 'constructs', 'typescript', 'esm'],

  tsconfig: {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: javascript.TypeScriptModuleResolution.NODE_NEXT,
      lib: ['ES2022'],
      strict: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      verbatimModuleSyntax: true,
    },
  },
  tsconfigDev: {
    include: ['src/**/*.ts', 'test/**/*.ts', '.projenrc.ts'],
  },
});

project.package.addField('type', 'module');
project.package.addField('exports', {
  '.': {
    types: './lib/index.d.ts',
    import: './lib/index.js',
  },
});
project.package.addField('sideEffects', false);

new TextFile(project, '.github/release.yml', {
  lines: [
    'changelog:',
    '  exclude:',
    '    labels:',
    '      - ignore-for-release',
    '    authors:',
    '      - dependabot',
    '  categories:',
    '    - title: Breaking Changes',
    '      labels:',
    '        - breaking-change',
    '    - title: Features',
    '      labels:',
    '        - feature',
    '        - enhancement',
    '    - title: Fixes',
    '      labels:',
    '        - bug',
    '        - fix',
    '    - title: Documentation',
    '      labels:',
    '        - documentation',
    '    - title: Maintenance',
    '      labels:',
    '        - dependencies',
    '        - maintenance',
    '    - title: Other Changes',
    '      labels:',
    '        - "*"',
    '',
  ],
});

new TextFile(project, '.github/ISSUE_TEMPLATE/bug_report.yml', {
  lines: [
    'name: Bug report',
    'description: Report a reproducible problem with the construct library',
    'title: "fix: "',
    'labels: ["bug"]',
    'body:',
    '  - type: markdown',
    '    attributes:',
    '      value: Thanks for taking the time to report a bug.',
    '  - type: textarea',
    '    id: summary',
    '    attributes:',
    '      label: Summary',
    '      description: What happened?',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: reproduction',
    '    attributes:',
    '      label: Reproduction',
    '      description: Provide a minimal CDK stack or test case that reproduces the issue.',
    '      render: ts',
    '    validations:',
    '      required: true',
    '  - type: input',
    '    id: version',
    '    attributes:',
    '      label: Package version',
    '      placeholder: "@cdk-construct/library@0.0.0"',
    '    validations:',
    '      required: true',
    '  - type: input',
    '    id: cdk-version',
    '    attributes:',
    '      label: AWS CDK version',
    '      placeholder: "2.x"',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: environment',
    '    attributes:',
    '      label: Environment',
    '      description: Node.js, package manager, OS, and any relevant AWS account or region context.',
    '    validations:',
    '      required: true',
    '',
  ],
});

new TextFile(project, '.github/ISSUE_TEMPLATE/feature_request.yml', {
  lines: [
    'name: Feature request',
    'description: Suggest a new construct, option, or behavior',
    'title: "feat: "',
    'labels: ["feature"]',
    'body:',
    '  - type: textarea',
    '    id: problem',
    '    attributes:',
    '      label: Problem',
    '      description: What use case should this solve?',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: proposal',
    '    attributes:',
    '      label: Proposal',
    '      description: Describe the API or behavior you want.',
    '      render: ts',
    '    validations:',
    '      required: true',
    '  - type: textarea',
    '    id: alternatives',
    '    attributes:',
    '      label: Alternatives considered',
    '      description: What workarounds or alternate designs have you considered?',
    '  - type: textarea',
    '    id: release-impact',
    '    attributes:',
    '      label: Release impact',
    '      description: Note any public API, migration, or compatibility concerns.',
    '',
  ],
});

new TextFile(project, '.github/ISSUE_TEMPLATE/config.yml', {
  lines: [
    'blank_issues_enabled: true',
    'contact_links:',
    '  - name: AWS CDK documentation',
    '    url: https://docs.aws.amazon.com/cdk/',
    '    about: Reference material for AWS CDK usage and concepts.',
    '',
  ],
});

new TextFile(project, 'eslint.config.js', {
  readonly: false,
  lines: [
    "import gts from 'gts';",
    '',
    'const config = gts.map((entry) => {',
    "  if (entry.files?.some((pattern) => pattern.includes('*.ts'))) {",
    '    return {',
    '      ...entry,',
    '      languageOptions: {',
    '        ...entry.languageOptions,',
    '        parserOptions: {',
    '          ...entry.languageOptions?.parserOptions,',
    "          project: './tsconfig.dev.json',",
    '        },',
    '      },',
    '    };',
    '  }',
    '',
    '  return entry;',
    '});',
    '',
    'export default [',
    '  {',
    "    ignores: ['lib/**', 'dist/**', 'coverage/**', 'test-reports/**', 'node_modules/**'],",
    '  },',
    '  ...config,',
    '];',
    '',
  ],
});

project.addTask('lint', {
  description: 'Lint TypeScript sources',
  exec: 'eslint src test .projenrc.ts --fix --no-error-on-unmatched-pattern',
});

project.addTask('format', {
  description: 'Format source files with Prettier and ESLint fixes',
  exec: 'prettier --write --no-error-on-unmatched-pattern README.md .projenrc.ts eslint.config.js "src/**/*.ts" "test/**/*.ts" && eslint src test .projenrc.ts --fix --no-error-on-unmatched-pattern',
});

project.addTask('format:check', {
  description: 'Check source formatting with Prettier',
  exec: 'prettier --check --no-error-on-unmatched-pattern README.md .projenrc.ts eslint.config.js "src/**/*.ts" "test/**/*.ts"',
});

project.addTask('clean', {
  description: 'Remove generated build artifacts',
  exec: 'rm -rf lib dist coverage test-reports .jsii .npm-cache tsconfig.tsbuildinfo',
});

project.addTask('deploy', {
  description: 'Build and publish the generated npm tarball',
  exec: 'npm run build && npm publish dist/js/*.tgz --access public',
});

project.gitignore.addPatterns('/.npm-cache/');
project.addPackageIgnore('/.npm-cache/');
project.addPackageIgnore('/eslint.config.js');
project.tasks.tryFind('package')?.reset('mkdir -p dist/js');
project.tasks
  .tryFind('package')
  ?.exec('npm_config_cache=.npm-cache npm pack --pack-destination dist/js');

project.package.setScript('lint', 'npx projen lint');
project.package.setScript('format', 'npx projen format');
project.package.setScript('format:check', 'npx projen format:check');
project.package.setScript('clean', 'npx projen clean');
project.package.setScript('deploy', 'npx projen deploy');

project.package.file.patch(JsonPatch.add('/publishConfig', { access: 'public' }));

project.defaultTask?.reset('node --loader ts-node/esm .projenrc.ts');

project.synth();
