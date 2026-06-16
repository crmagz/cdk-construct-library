import assert from 'node:assert/strict';
import test from 'node:test';

import {
  packageNamesFromFerrflow,
  parseConventionalSubject,
  validateReleaseScopeCommits,
} from '../scripts/validate-release-scopes.mjs';

const packageNames = ['cloudfront', 'core', 'iam', 's3', 'sqs'];

test('parses conventional commit subjects with package scopes', () => {
  assert.deepEqual(parseConventionalSubject('feat(cloudfront): add distribution construct'), {
    type: 'feat',
    scope: 'cloudfront',
    breaking: false,
    description: 'add distribution construct',
  });
  assert.deepEqual(parseConventionalSubject('feat!(core): redesign environment props'), {
    type: 'feat',
    scope: 'core',
    breaking: true,
    description: 'redesign environment props',
  });
});

test('reads package names from ferrflow config', () => {
  assert.deepEqual(
    packageNamesFromFerrflow({
      package: [{ name: 's3' }, { name: 'core' }],
    }),
    ['core', 's3'],
  );
});

test('allows package-scoped releasable commits that touch the matching package', () => {
  const errors = validateReleaseScopeCommits({
    packageNames,
    commits: [
      {
        hash: 'abc1234',
        subject: 'feat(cloudfront): add distribution construct',
        files: ['packages/cloudfront/src/distribution.ts', '.projenrc.ts', 'ferrflow.json'],
      },
      {
        hash: 'def5678',
        subject: 'fix(s3): enforce ssl policy',
        files: ['packages/s3/src/bucket.ts', 'packages/s3/test/bucket.test.ts'],
      },
    ],
  });

  assert.deepEqual(errors, []);
});

test('ignores non-releasable repo maintenance commits', () => {
  const errors = validateReleaseScopeCommits({
    packageNames,
    commits: [
      {
        hash: 'abc1234',
        subject: 'ci(release): build core before package publish',
        files: ['.projenrc.ts', 'ferrflow.json'],
      },
      {
        hash: 'def5678',
        subject: 'docs(release): explain package baseline tags',
        files: ['docs/release-process.md'],
      },
    ],
  });

  assert.deepEqual(errors, []);
});

test('rejects releasable commits without a configured package scope', () => {
  const errors = validateReleaseScopeCommits({
    packageNames,
    commits: [
      {
        hash: 'abc1234',
        subject: 'fix(release): build core before package publish',
        files: ['.projenrc.ts', 'ferrflow.json'],
      },
      {
        hash: 'def5678',
        subject: 'feat: add new construct',
        files: ['packages/s3/src/bucket.ts'],
      },
    ],
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /not a configured package/);
  assert.match(errors[1], /without a package scope/);
});

test('rejects package-scoped commits that do not touch the matching package path', () => {
  const errors = validateReleaseScopeCommits({
    packageNames,
    commits: [
      {
        hash: 'abc1234',
        subject: 'feat(cloudfront): add distribution construct',
        files: ['packages/s3/src/bucket.ts'],
      },
    ],
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /does not touch packages\/cloudfront\//);
  assert.match(errors[1], /also touches other package directories: s3/);
});
