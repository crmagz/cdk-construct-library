import { JsonFile, JsonPatch, ReleasableCommits, TextFile, javascript, typescript } from 'projen';

const corePackageName = '@cdk-construct/core';
const auroraPackageName = '@cdk-construct/aurora';
const eksPackageName = '@cdk-construct/eks';
const repositoryUrl = 'git+https://github.com/crmagz/cdk-construct-library.git';

const project = new typescript.TypeScriptProject({
  name: '@cdk-construct/library',
  packageName: '@cdk-construct/library',
  description: 'AWS CDK construct library',
  authorName: 'crmagz',
  authorEmail: '33166233+crmagz@users.noreply.github.com',
  repository: repositoryUrl,
  defaultReleaseBranch: 'main',
  packageManager: javascript.NodePackageManager.NPM,
  npmAccess: javascript.NpmAccess.PUBLIC,
  npmProvenance: true,
  npmTrustedPublishing: true,

  minNodeVersion: '20.0.0',
  workflowNodeVersion: '24.16.0',

  projenrcTs: true,
  projenVersion: '0.99.71',
  sampleCode: false,
  releaseToNpm: true,
  releasableCommits: ReleasableCommits.everyCommit('packages/core'),
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
    include: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts', '.projenrc.ts'],
  },
});

project.package.addField('private', true);
project.package.addField('workspaces', ['packages/*']);
project.package.addField('type', 'module');
project.package.addField('packageManager', 'npm@11.16.0');
project.package.addField('exports', {
  '.': {
    types: './lib/index.d.ts',
    import: './lib/index.js',
  },
});
project.package.addField('sideEffects', false);

new JsonFile(project, 'packages/core/package.json', {
  readonly: false,
  obj: {
    name: corePackageName,
    version: '0.0.0',
    description: 'Core utilities and shared types for paved-road AWS CDK constructs',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/core',
    },
    author: {
      name: 'crmagz',
      email: '33166233+crmagz@users.noreply.github.com',
    },
    license: 'Apache-2.0',
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/index.d.ts',
    exports: {
      '.': {
        types: './lib/index.d.ts',
        import: './lib/index.js',
      },
    },
    files: ['lib', 'README.md'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    peerDependencies: {
      'aws-cdk-lib': '^2.236.0',
      constructs: '^10.4.0',
    },
    devDependencies: {
      'aws-cdk-lib': '2.236.0',
      constructs: '10.4.0',
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'core', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: 'npm@11.16.0',
  },
});

new JsonFile(project, 'packages/core/tsconfig.json', {
  obj: {
    compilerOptions: {
      rootDir: 'src',
      outDir: 'lib',
      alwaysStrict: true,
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      forceConsistentCasingInFileNames: true,
      inlineSourceMap: true,
      inlineSources: true,
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmitOnError: false,
      noFallthroughCasesInSwitch: true,
      noImplicitAny: true,
      noImplicitReturns: true,
      noImplicitThis: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      strictPropertyInitialization: true,
      stripInternal: true,
      target: 'ES2022',
      types: ['node'],
      verbatimModuleSyntax: true,
    },
    include: ['src/**/*.ts'],
    exclude: ['lib', 'node_modules'],
  },
});

new JsonFile(project, 'packages/aurora/package.json', {
  readonly: false,
  obj: {
    name: auroraPackageName,
    version: '0.0.0',
    description: 'Aurora PostgreSQL and MySQL constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/aurora',
    },
    author: {
      name: 'crmagz',
      email: '33166233+crmagz@users.noreply.github.com',
    },
    license: 'Apache-2.0',
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/index.d.ts',
    exports: {
      '.': {
        types: './lib/index.d.ts',
        import: './lib/index.js',
      },
    },
    files: ['lib', 'README.md'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    peerDependencies: {
      'aws-cdk-lib': '^2.236.0',
      constructs: '^10.4.0',
    },
    devDependencies: {
      'aws-cdk-lib': '2.236.0',
      constructs: '10.4.0',
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'aurora', 'rds', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: 'npm@11.16.0',
  },
});

new JsonFile(project, 'packages/aurora/tsconfig.json', {
  obj: {
    compilerOptions: {
      rootDir: 'src',
      outDir: 'lib',
      alwaysStrict: true,
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      forceConsistentCasingInFileNames: true,
      inlineSourceMap: true,
      inlineSources: true,
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmitOnError: false,
      noFallthroughCasesInSwitch: true,
      noImplicitAny: true,
      noImplicitReturns: true,
      noImplicitThis: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      strictPropertyInitialization: true,
      stripInternal: true,
      target: 'ES2022',
      types: ['node'],
      verbatimModuleSyntax: true,
    },
    include: ['src/**/*.ts'],
    exclude: ['lib', 'node_modules'],
  },
});

new JsonFile(project, 'packages/eks/package.json', {
  readonly: false,
  obj: {
    name: eksPackageName,
    version: '0.0.0',
    description: 'EKS constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/eks',
    },
    author: {
      name: 'crmagz',
      email: '33166233+crmagz@users.noreply.github.com',
    },
    license: 'Apache-2.0',
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/index.d.ts',
    exports: {
      '.': {
        types: './lib/index.d.ts',
        import: './lib/index.js',
      },
    },
    files: ['lib', 'README.md'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    peerDependencies: {
      'aws-cdk-lib': '^2.236.0',
      constructs: '^10.4.0',
    },
    devDependencies: {
      'aws-cdk-lib': '2.236.0',
      constructs: '10.4.0',
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'eks', 'kubernetes', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: 'npm@11.16.0',
  },
});

new JsonFile(project, 'packages/eks/tsconfig.json', {
  obj: {
    compilerOptions: {
      rootDir: 'src',
      outDir: 'lib',
      alwaysStrict: true,
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      forceConsistentCasingInFileNames: true,
      inlineSourceMap: true,
      inlineSources: true,
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmitOnError: false,
      noFallthroughCasesInSwitch: true,
      noImplicitAny: true,
      noImplicitReturns: true,
      noImplicitThis: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      strictPropertyInitialization: true,
      stripInternal: true,
      target: 'ES2022',
      types: ['node'],
      verbatimModuleSyntax: true,
    },
    include: ['src/**/*.ts'],
    exclude: ['lib', 'node_modules'],
  },
});

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
    "    ignores: ['lib/**', 'packages/*/lib/**', 'dist/**', 'coverage/**', 'test-reports/**', 'node_modules/**'],",
    '  },',
    '  ...config,',
    '];',
    '',
  ],
});

project.addTask('lint', {
  description: 'Lint TypeScript sources',
  exec: 'eslint "packages/*/src/**/*.ts" "packages/*/test/**/*.ts" .projenrc.ts --fix --no-error-on-unmatched-pattern',
});

project.addTask('format', {
  description: 'Format source files with Prettier and ESLint fixes',
  exec: 'prettier --write --no-error-on-unmatched-pattern README.md "docs/**/*.md" "packages/*/README.md" .projenrc.ts eslint.config.js "packages/*/src/**/*.ts" "packages/*/test/**/*.ts" && eslint "packages/*/src/**/*.ts" "packages/*/test/**/*.ts" .projenrc.ts --fix --no-error-on-unmatched-pattern',
});

project.addTask('format:check', {
  description: 'Check source formatting with Prettier',
  exec: 'prettier --check --no-error-on-unmatched-pattern README.md "docs/**/*.md" "packages/*/README.md" .projenrc.ts eslint.config.js "packages/*/src/**/*.ts" "packages/*/test/**/*.ts"',
});

project.addTask('clean', {
  description: 'Remove generated build artifacts',
  exec: 'rm -rf lib packages/*/lib dist coverage test-reports .jsii .npm-cache tsconfig.tsbuildinfo packages/*/tsconfig.tsbuildinfo',
});

project.addTask('deploy', {
  description: 'Build and publish the generated npm tarball',
  exec: 'npm run build && npm publish dist/js/*.tgz --access public',
});

project.gitignore.addPatterns('/.npm-cache/', '/packages/*/lib/');
project.addPackageIgnore('/.npm-cache/');
project.addPackageIgnore('/eslint.config.js');
project.tasks.tryFind('package')?.reset('mkdir -p dist/js');
project.tasks
  .tryFind('package')
  ?.exec(
    `npm_config_cache=.npm-cache npm pack --workspace ${corePackageName} --pack-destination dist/js`,
  );

project.tasks.tryFind('compile')?.reset('npm run build --workspaces --if-present');

project.package.setScript('lint', 'projen lint');
project.package.setScript('format', 'projen format');
project.package.setScript('format:check', 'projen format:check');
project.package.setScript('clean', 'projen clean');
project.package.setScript('deploy', 'projen deploy');

project.package.file.patch(
  JsonPatch.replace('/jest/testMatch', [
    '<rootDir>/packages/*/@(src|test)/**/*(*.)@(spec|test).ts?(x)',
    '<rootDir>/packages/*/@(src|test)/**/__tests__/**/*.ts?(x)',
  ]),
);

project.package.file.patch(JsonPatch.add('/publishConfig', { access: 'public' }));
project.package.file.patch(
  JsonPatch.replace('/devEngines/packageManager', {
    name: 'npm',
    version: '11.16.0',
    onFail: 'warn',
  }),
);

for (const taskName of ['bump', 'unbump']) {
  const task = project.tasks.tryFind(taskName);
  task?.env('OUTFILE', 'packages/core/package.json');
  task?.env('RELEASE_TAG_PREFIX', 'core/');
}

project.github?.tryFindWorkflow('release')?.file?.patch(
  JsonPatch.add('/jobs/release_npm/steps/1', {
    name: 'Upgrade npm for trusted publishing',
    run: 'npm install -g npm@11.16.0\nnpm --version',
  }),
);

project.github?.tryFindWorkflow('release')?.file?.patch(
  JsonPatch.add('/jobs/release_eks', {
    name: `Release ${eksPackageName}`,
    'runs-on': 'ubuntu-latest',
    permissions: {
      contents: 'write',
      'id-token': 'write',
    },
    env: {
      CI: 'true',
      PACKAGE_NAME: eksPackageName,
      PACKAGE_DIR: 'packages/eks',
      COMMIT_SCOPE: 'eks',
      RELEASE_TAG_PREFIX: 'eks/',
      NPM_CONFIG_PROVENANCE: 'true',
    },
    steps: [
      {
        name: 'Checkout',
        uses: 'actions/checkout@v6',
        with: {
          'fetch-depth': 0,
        },
      },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v6',
        with: {
          'node-version': '24.16.0',
          'package-manager-cache': false,
        },
      },
      {
        name: 'Upgrade npm for trusted publishing',
        run: 'npm install -g npm@11.16.0\nnpm --version',
      },
      {
        name: 'Install dependencies',
        run: 'npm ci',
      },
      {
        name: 'Prepare release',
        run: 'node scripts/release-workspace-package.mjs',
      },
      {
        name: 'Read release metadata',
        id: 'release_meta',
        run: [
          'TAG=$(cat dist/releasetag.txt)',
          'echo "tag=$TAG" >> "$GITHUB_OUTPUT"',
          'if [ -z "$TAG" ]; then',
          '  echo "should_release=false" >> "$GITHUB_OUTPUT"',
          'elif git ls-remote -q --exit-code --tags origin "$TAG"; then',
          '  echo "should_release=false" >> "$GITHUB_OUTPUT"',
          'else',
          '  echo "should_release=true" >> "$GITHUB_OUTPUT"',
          'fi',
          'cat "$GITHUB_OUTPUT"',
        ].join('\n'),
      },
      {
        name: 'Publish to npm',
        if: "steps.release_meta.outputs.should_release == 'true' && github.event.inputs.dry_run != 'true'",
        run: 'npm publish dist/js/*.tgz --access public --provenance',
      },
      {
        name: 'Publish to GitHub Releases',
        if: "steps.release_meta.outputs.should_release == 'true' && github.event.inputs.dry_run != 'true'",
        env: {
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        },
        run: 'gh release create "${{ steps.release_meta.outputs.tag }}" -F dist/changelog.md -t "${{ steps.release_meta.outputs.tag }}" --target "$GITHUB_SHA"',
      },
    ],
  }),
);

project.defaultTask?.reset('node --loader ts-node/esm .projenrc.ts');

project.synth();
