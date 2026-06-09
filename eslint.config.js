import gts from 'gts';

const config = gts.map((entry) => {
  if (entry.files?.some((pattern) => pattern.includes('*.ts'))) {
    return {
      ...entry,
      languageOptions: {
        ...entry.languageOptions,
        parserOptions: {
          ...entry.languageOptions?.parserOptions,
          project: './tsconfig.dev.json',
        },
      },
    };
  }

  return entry;
});

export default [
  {
    ignores: ['lib/**', 'packages/*/lib/**', 'dist/**', 'coverage/**', 'test-reports/**', 'node_modules/**'],
  },
  ...config,
];
