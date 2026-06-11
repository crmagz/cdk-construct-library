import { readFileSync } from 'node:fs';

import { JsonFile, JsonPatch, TextFile, javascript, typescript } from 'projen';

const corePackageName = '@cdk-construct/core';
const auroraPackageName = '@cdk-construct/aurora';
const s3PackageName = '@cdk-construct/s3';
const sqsPackageName = '@cdk-construct/sqs';
const iamPackageName = '@cdk-construct/iam';
const cloudfrontPackageName = '@cdk-construct/cloudfront';
const repositoryUrl = 'git+https://github.com/crmagz/cdk-construct-library.git';
const nodeVersion = '24.16.0';
const npmVersion = '11.16.0';
const ferrFlowVersion = '5.2.4';
const awsCdkCliVersion = '2.1126.0';
const awsCdkLibVersion = '2.258.1';
const constructsVersion = '10.6.0';
const nodeTypesVersion = '24.13.2';
const typescriptVersion = '6.0.3';
const cdkNagVersion = '3.0.0';
const lefthookVersion = '2.1.9';
const awsCdkLibPeerVersion = `^${awsCdkLibVersion}`;
const constructsPeerVersion = `^${constructsVersion}`;
const conventionalCommitTypes = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

const packageVersion = (packageJsonPath: string, fallback = '0.0.0'): string => {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string;
    };

    return packageJson.version ?? fallback;
  } catch {
    return fallback;
  }
};

const workspacePackages = [
  {
    service: 'core',
    packageName: corePackageName,
    path: 'packages/core',
  },
  {
    service: 'aurora',
    packageName: auroraPackageName,
    path: 'packages/aurora',
  },
  {
    service: 's3',
    packageName: s3PackageName,
    path: 'packages/s3',
  },
  {
    service: 'sqs',
    packageName: sqsPackageName,
    path: 'packages/sqs',
  },
  {
    service: 'iam',
    packageName: iamPackageName,
    path: 'packages/iam',
  },
  {
    service: 'cloudfront',
    packageName: cloudfrontPackageName,
    path: 'packages/cloudfront',
  },
];

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
  workflowNodeVersion: nodeVersion,

  projenrcTs: true,
  projenVersion: '0.99.71',
  sampleCode: false,
  release: false,
  depsUpgrade: false,
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
    '- [ ] `npm run security`',
    '- [ ] `npm run build`',
    '',
    '## Checklist',
    '',
    '- [ ] PR title follows conventional commit format',
    '- [ ] Self-reviewed my own code',
    '- [ ] Docs updated (if behavior changed)',
    '- [ ] No new warnings generated',
  ],

  typescriptVersion,
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

  peerDeps: [`aws-cdk-lib@${awsCdkLibPeerVersion}`, `constructs@${constructsPeerVersion}`],
  devDeps: [
    `@types/node@${nodeTypesVersion}`,
    'eslint@^9.37.0',
    `aws-cdk@${awsCdkCliVersion}`,
    `aws-cdk-lib@${awsCdkLibVersion}`,
    `cdk-nag@${cdkNagVersion}`,
    `constructs@${constructsVersion}`,
    'gts@^7.0.0',
    `lefthook@${lefthookVersion}`,
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
    compilerOptions: {
      isolatedModules: true,
      paths: {
        [corePackageName]: ['packages/core/src/index.ts'],
      },
    },
    include: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts', '.projenrc.ts'],
  },
});

project.package.addField('private', true);
project.package.addField('workspaces', ['packages/*']);
project.package.addField('type', 'module');
project.package.addField('packageManager', `npm@${npmVersion}`);
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
    version: packageVersion('packages/core/package.json'),
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
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'core', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
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
    version: packageVersion('packages/aurora/package.json'),
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
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'aurora', 'rds', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
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

new JsonFile(project, 'packages/s3/package.json', {
  readonly: false,
  obj: {
    name: s3PackageName,
    version: packageVersion('packages/s3/package.json'),
    description: 'S3 bucket constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/s3',
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
    files: ['lib', 'README.md', 'docs'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    dependencies: {
      [corePackageName]: `^${packageVersion('packages/core/package.json')}`,
    },
    peerDependencies: {
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 's3', 'storage', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
  },
});

new JsonFile(project, 'packages/s3/tsconfig.json', {
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

new JsonFile(project, 'packages/sqs/package.json', {
  readonly: false,
  obj: {
    name: sqsPackageName,
    version: packageVersion('packages/sqs/package.json'),
    description: 'SQS queue constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/sqs',
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
    files: ['lib', 'README.md', 'docs'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    dependencies: {
      [corePackageName]: `^${packageVersion('packages/core/package.json')}`,
    },
    peerDependencies: {
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'sqs', 'queue', 'messaging', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
  },
});

new JsonFile(project, 'packages/sqs/tsconfig.json', {
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

new JsonFile(project, 'packages/iam/package.json', {
  readonly: false,
  obj: {
    name: iamPackageName,
    version: packageVersion('packages/iam/package.json'),
    description: 'IAM role constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/iam',
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
    files: ['lib', 'README.md', 'docs'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    dependencies: {
      [corePackageName]: `^${packageVersion('packages/core/package.json')}`,
    },
    peerDependencies: {
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'iam', 'irsa', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
  },
});

new JsonFile(project, 'packages/iam/tsconfig.json', {
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

new JsonFile(project, 'packages/cloudfront/package.json', {
  readonly: false,
  obj: {
    name: cloudfrontPackageName,
    version: packageVersion('packages/cloudfront/package.json'),
    description: 'CloudFront distribution constructs for AWS CDK',
    repository: {
      type: 'git',
      url: repositoryUrl,
      directory: 'packages/cloudfront',
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
    files: ['lib', 'README.md', 'docs'],
    sideEffects: false,
    publishConfig: {
      access: 'public',
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      clean: 'rm -rf lib tsconfig.tsbuildinfo',
      package: 'npm pack --pack-destination ../../dist/js',
    },
    dependencies: {
      [corePackageName]: `^${packageVersion('packages/core/package.json')}`,
    },
    peerDependencies: {
      'aws-cdk-lib': awsCdkLibPeerVersion,
      constructs: constructsPeerVersion,
    },
    devDependencies: {
      'aws-cdk-lib': awsCdkLibVersion,
      constructs: constructsVersion,
    },
    keywords: ['aws-cdk', 'cdk', 'constructs', 'cloudfront', 'cdn', 'typescript', 'esm'],
    engines: {
      node: '>= 20.0.0',
    },
    packageManager: `npm@${npmVersion}`,
  },
});

new JsonFile(project, 'packages/cloudfront/tsconfig.json', {
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

new JsonFile(project, 'ferrflow.json', {
  obj: {
    $schema: 'https://ferrflow.com/schema/ferrflow.json',
    workspace: {
      remote: 'origin',
      branch: 'main',
      anonymous_telemetry: false,
      versioning: 'semver',
      tagTemplate: '{name}/v{version}',
      recoverMissedReleases: true,
      releaseCommitMode: 'commit',
      releaseCommitScope: 'grouped',
      skipCi: true,
    },
    package: workspacePackages.map((workspacePackage) => ({
      name: workspacePackage.service,
      path: workspacePackage.path,
      changelog: `${workspacePackage.path}/CHANGELOG.md`,
      versionedFiles: [
        {
          path: `${workspacePackage.path}/package.json`,
          format: 'json',
        },
      ],
      hooks: {
        postPublish: `npm run build --workspace ${workspacePackage.packageName} && npm publish --workspace ${workspacePackage.packageName} --access public`,
      },
    })),
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

new TextFile(project, '.github/workflows/release.yml', {
  lines: [
    '# ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".',
    '',
    'name: release',
    '',
    'on:',
    '  push:',
    '    branches:',
    '      - main',
    '  workflow_dispatch:',
    '',
    'concurrency:',
    '  group: ${{ github.workflow }}',
    '  cancel-in-progress: false',
    '',
    'jobs:',
    '  release:',
    '    runs-on: ubuntu-latest',
    '    permissions:',
    '      contents: write',
    '      id-token: write',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v6',
    '        with:',
    '          fetch-depth: 0',
    '          token: ${{ secrets.TOKEN }}',
    '      - name: Set git identity',
    '        run: |-',
    '          git config user.name "crmagz"',
    '          git config user.email "33166233+crmagz@users.noreply.github.com"',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v6',
    '        with:',
    `          node-version: ${nodeVersion}`,
    '          package-manager-cache: false',
    '      - name: Upgrade npm for trusted publishing',
    '        run: |-',
    `          npm install -g npm@${npmVersion}`,
    '          npm --version',
    '      - name: Install dependencies',
    '        run: npm ci',
    '      - name: Fetch release tags',
    '        run: git fetch --force --tags origin',
    '      - name: Release packages',
    `        uses: FerrLabs/FerrFlow@v${ferrFlowVersion}`,
    '        with:',
    `          version: ${ferrFlowVersion}`,
    '          mode: release',
    '        env:',
    '          GITHUB_TOKEN: ${{ secrets.TOKEN }}',
    '          DO_NOT_TRACK: "1"',
    '          NPM_CONFIG_ACCESS: public',
    '          NPM_CONFIG_PROVENANCE: "true"',
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
    '    ignores: [',
    "      'lib/**',",
    "      'packages/*/lib/**',",
    "      'dist/**',",
    "      'coverage/**',",
    "      'test-reports/**',",
    "      'node_modules/**',",
    '    ],',
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
  exec: 'prettier --write --no-error-on-unmatched-pattern README.md "docs/**/*.md" "packages/*/README.md" .projenrc.ts eslint.config.js "scripts/**/*.mjs" "tests/**/*.mjs" "packages/*/src/**/*.ts" "packages/*/test/**/*.ts" && eslint "packages/*/src/**/*.ts" "packages/*/test/**/*.ts" .projenrc.ts --fix --no-error-on-unmatched-pattern',
});

project.addTask('format:check', {
  description: 'Check source formatting with Prettier',
  exec: 'prettier --check --no-error-on-unmatched-pattern README.md "docs/**/*.md" "packages/*/README.md" .projenrc.ts eslint.config.js "scripts/**/*.mjs" "tests/**/*.mjs" "packages/*/src/**/*.ts" "packages/*/test/**/*.ts"',
});

project.addTask('clean', {
  description: 'Remove generated build artifacts',
  exec: 'rm -rf lib packages/*/lib dist coverage test-reports .jsii .npm-cache tsconfig.tsbuildinfo packages/*/tsconfig.tsbuildinfo',
});

project.addTask('security', {
  description: 'Run CDK security policy validation tests',
  exec: 'NODE_OPTIONS=--experimental-vm-modules jest --testMatch "<rootDir>/packages/*/test/**/*.security.test.ts" --passWithNoTests',
});

project.addTask('deploy', {
  description: 'Publish releasable workspace packages with FerrFlow',
  exec: 'ferrflow release',
});

new TextFile(project, 'lefthook.yml', {
  lines: [
    '# ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".',
    '',
    'pre-commit:',
    '  parallel: true',
    '  commands:',
    '    format-check:',
    '      run: npm run format:check',
    '    security:',
    '      run: npm run security',
    '',
  ],
});

project.gitignore.addPatterns(
  '/.npm-cache/',
  '/packages/*/lib/',
  '/.CLAUDE/',
  '/.claude/',
  '/.codex/',
  '/.cursor/',
  '/.continue/',
  '/.windsurf/',
  '/.agents/',
  '/AGENTS.md',
  '/AGENT.md',
  '/agents.md',
  '/agent.md',
);
project.addPackageIgnore('/.npm-cache/');
project.addPackageIgnore('/eslint.config.js');
project.tasks.tryFind('package')?.reset('mkdir -p dist/js');
project.tasks
  .tryFind('package')
  ?.exec('npm_config_cache=.npm-cache npm pack --workspaces --pack-destination dist/js');

project.tasks.tryFind('compile')?.reset('npm run build --workspaces --if-present');
project.tasks
  .tryFind('test')
  ?.reset(
    'node --test "tests/*.test.mjs" && NODE_OPTIONS=--experimental-vm-modules jest --passWithNoTests --updateSnapshot',
  );

project.package.setScript('lint', 'projen lint');
project.package.setScript('format', 'projen format');
project.package.setScript('format:check', 'projen format:check');
project.package.setScript('clean', 'projen clean');
project.package.setScript('deploy', 'projen deploy');
project.package.setScript('security', 'projen security');
project.package.setScript('hooks:install', 'lefthook install');
project.package.setScript('hooks:run', 'lefthook run pre-commit');
project.package.setScript('prepare', 'lefthook install');

project.package.file.patch(
  JsonPatch.replace('/jest/testMatch', [
    '<rootDir>/packages/*/@(src|test)/**/*(*.)@(spec|test).ts?(x)',
    '<rootDir>/packages/*/@(src|test)/**/__tests__/**/*.ts?(x)',
  ]),
);
project.package.file.patch(JsonPatch.add('/jest/preset', 'ts-jest/presets/default-esm'));
project.package.file.patch(JsonPatch.add('/jest/extensionsToTreatAsEsm', ['.ts']));
project.package.file.patch(
  JsonPatch.add('/jest/moduleNameMapper', {
    [`^${corePackageName}$`]: '<rootDir>/packages/core/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  }),
);
project.package.file.patch(
  JsonPatch.replace('/jest/transform/^.+\\.[t]sx?$/1', {
    tsconfig: 'tsconfig.dev.json',
    useESM: true,
  }),
);

project.package.file.patch(JsonPatch.add('/publishConfig', { access: 'public' }));
project.package.file.patch(
  JsonPatch.replace('/devEngines/packageManager', {
    name: 'npm',
    version: npmVersion,
    onFail: 'warn',
  }),
);

project.github
  ?.tryFindWorkflow('pull-request-lint')
  ?.file?.patch(
    JsonPatch.replace('/jobs/validate/steps/0/with/types', conventionalCommitTypes.join('\n')),
  );

project.github?.tryFindWorkflow('build')?.file?.patch(
  JsonPatch.replace('/jobs/build/steps/2/run', 'npm ci'),
  JsonPatch.replace('/jobs/build/steps/3/name', 'synth'),
  JsonPatch.replace('/jobs/build/steps/3/run', 'npx projen default'),
  JsonPatch.add('/jobs/build/steps/4', {
    name: 'format:check',
    run: 'npm run format:check',
  }),
  JsonPatch.add('/jobs/build/steps/5', {
    name: 'lint',
    run: 'npm run lint',
  }),
  JsonPatch.add('/jobs/build/steps/6', {
    name: 'security',
    run: 'npm run security',
  }),
  JsonPatch.add('/jobs/build/steps/7', {
    name: 'test',
    run: 'npm test',
  }),
  JsonPatch.add('/jobs/build/steps/8', {
    name: 'compile',
    run: 'npm run compile',
  }),
  JsonPatch.add('/jobs/build/steps/9', {
    name: 'package',
    run: 'npm run package',
  }),
);

project.defaultTask?.reset('node --loader ts-node/esm .projenrc.ts');

project.synth();
