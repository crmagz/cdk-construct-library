import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReleasePlan,
  incrementVersion,
  releaseNotes,
  releaseTypeForCommit,
  releaseTypeForCommits,
  serviceName,
  tagVersion,
} from './release-workspace-packages.mjs';

const cwd = process.cwd();

function commit(subject, body = '') {
  return {
    hash: `abcdef${subject.length}`,
    subject,
    body,
  };
}

function workspace(name, relativePath, version = '0.0.0') {
  return {
    directory: cwd,
    packageJson: {
      name,
      version,
    },
    packageJsonPath: `${cwd}/package.json`,
    relativePath,
    service: serviceName(name),
  };
}

test('maps conventional commit types to release types', () => {
  assert.equal(releaseTypeForCommit(commit('feat(s3): add bucket construct')), 'minor');
  assert.equal(releaseTypeForCommit(commit('fix(core): preserve metadata')), 'patch');
  assert.equal(releaseTypeForCommit(commit('perf(aurora): reduce policy size')), 'patch');
  assert.equal(releaseTypeForCommit(commit('docs(s3): update readme')), 'none');
  assert.equal(releaseTypeForCommit(commit('chore: update generated files')), 'none');
});

test('detects breaking changes from header bang and footer', () => {
  assert.equal(releaseTypeForCommit(commit('feat!(s3): redesign props')), 'major');
  assert.equal(
    releaseTypeForCommit(
      commit('feat(s3): redesign props', 'BREAKING CHANGE: bucket props were renamed'),
    ),
    'major',
  );
});

test('selects the highest release type across commits', () => {
  assert.equal(
    releaseTypeForCommits([
      commit('fix(s3): preserve encryption setting'),
      commit('feat(s3): add bucket construct'),
      commit('docs(s3): update readme'),
    ]),
    'minor',
  );

  assert.equal(
    releaseTypeForCommits([
      commit('fix(s3): preserve encryption setting'),
      commit('feat!(s3): redesign bucket props'),
    ]),
    'major',
  );
});

test('increments semantic versions by release type', () => {
  assert.equal(incrementVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(incrementVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(incrementVersion('1.2.3', 'major'), '2.0.0');
  assert.throws(() => incrementVersion('1.2.3', 'none'), /Unsupported release type/);
});

test('parses package names and service tag versions', () => {
  assert.equal(serviceName('@cdk-construct/s3'), 's3');
  assert.equal(tagVersion('s3/v0.1.0'), '0.1.0');
  assert.equal(tagVersion(undefined), undefined);
  assert.throws(() => serviceName('@other/s3'), /Unexpected package name/);
});

test('creates release plan only for packages with releasable commits', () => {
  const s3 = workspace('@cdk-construct/s3', 'packages/s3');
  const core = workspace('@cdk-construct/core', 'packages/core', '0.0.1');
  const commitsByPath = new Map([
    ['packages/s3', [commit('feat(s3): add bucket construct')]],
    ['packages/core', [commit('docs(core): clarify metadata helpers')]],
  ]);

  const plan = createReleasePlan([s3, core], {
    latestTagForService: (service) => (service === 'core' ? 'core/v0.0.1' : undefined),
    commitsForPackagePath: (relativePath) => commitsByPath.get(relativePath) ?? [],
    baseVersionForWorkspace: (entry, latestTag) =>
      tagVersion(latestTag) ?? entry.packageJson.version,
    log: () => undefined,
  });

  assert.deepEqual(
    plan.map((release) => ({
      name: release.workspace.packageJson.name,
      fromVersion: release.fromVersion,
      releaseType: release.releaseType,
      toVersion: release.toVersion,
    })),
    [
      {
        name: '@cdk-construct/s3',
        fromVersion: '0.0.0',
        releaseType: 'minor',
        toVersion: '0.1.0',
      },
    ],
  );
});

test('release plan scopes commits by workspace path', () => {
  const s3 = workspace('@cdk-construct/s3', 'packages/s3');
  const aurora = workspace('@cdk-construct/aurora', 'packages/aurora');
  const commitsByPath = new Map([
    ['packages/s3', [commit('fix(s3): preserve bucket encryption')]],
    ['packages/aurora', [commit('feat(aurora): scaffold cluster construct')]],
  ]);

  const plan = createReleasePlan([s3, aurora], {
    commitsForPackagePath: (relativePath) => commitsByPath.get(relativePath) ?? [],
    baseVersionForWorkspace: (entry) => entry.packageJson.version,
    log: () => undefined,
  });

  assert.deepEqual(
    plan.map((release) => ({
      name: release.workspace.packageJson.name,
      toVersion: release.toVersion,
    })),
    [
      {
        name: '@cdk-construct/s3',
        toVersion: '0.0.1',
      },
      {
        name: '@cdk-construct/aurora',
        toVersion: '0.1.0',
      },
    ],
  );
});

test('renders release notes from commits', () => {
  assert.equal(
    releaseNotes(workspace('@cdk-construct/s3', 'packages/s3'), '0.1.0', [
      commit('feat(s3): add bucket construct'),
    ]),
    [
      '## @cdk-construct/s3 0.1.0',
      '',
      '### Changes',
      '',
      '- feat(s3): add bucket construct (abcdef3)',
      '',
    ].join('\n'),
  );
});
