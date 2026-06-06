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
