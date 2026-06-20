import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bumpVersion,
  releasePreviewsFromCommits,
  renderReleasePreviews,
} from '../scripts/preview-package-releases.mjs';

test('bumps versions by semantic impact', () => {
  assert.equal(bumpVersion({ version: '0.1.0', bump: 'patch' }), '0.1.1');
  assert.equal(bumpVersion({ version: '0.1.0', bump: 'minor' }), '0.2.0');
  assert.equal(bumpVersion({ version: '0.1.0', bump: 'major' }), '1.0.0');
});

test('previews only package-scoped release notes for matching package paths', () => {
  const previews = releasePreviewsFromCommits({
    packageNames: ['elasticache', 'opensearch'],
    packageVersions: {
      elasticache: '0.1.0',
      opensearch: '0.2.0',
    },
    commits: [
      {
        hash: 'aaa1111',
        subject: 'feat(elasticache): add replication group construct',
        files: ['packages/elasticache/src/replication-group.ts'],
      },
      {
        hash: 'bbb2222',
        subject: 'fix(opensearch): require production vpc placement',
        files: ['packages/opensearch/src/domain.ts'],
      },
      {
        hash: 'ccc3333',
        subject: 'feat(elasticache): incorrectly touch another package',
        files: ['packages/elasticache/src/index.ts', 'packages/opensearch/src/domain.ts'],
      },
      {
        hash: 'ddd4444',
        subject: 'docs(elasticache): document usage',
        files: ['packages/elasticache/README.md'],
      },
    ],
  });

  assert.deepEqual(
    previews.map((preview) => ({
      packageName: preview.packageName,
      currentVersion: preview.currentVersion,
      nextVersion: preview.nextVersion,
      bump: preview.bump,
      commits: preview.commits.map((commit) => commit.subject),
    })),
    [
      {
        packageName: 'elasticache',
        currentVersion: '0.1.0',
        nextVersion: '0.2.0',
        bump: 'minor',
        commits: ['feat(elasticache): add replication group construct'],
      },
      {
        packageName: 'opensearch',
        currentVersion: '0.2.0',
        nextVersion: '0.2.1',
        bump: 'patch',
        commits: ['fix(opensearch): require production vpc placement'],
      },
    ],
  );
});

test('renders a package-scoped release preview', () => {
  const preview = renderReleasePreviews([
    {
      packageName: 'elasticache',
      currentVersion: '0.1.0',
      nextVersion: '0.2.0',
      bump: 'minor',
      commits: [
        {
          hash: 'aaa1111',
          type: 'feat',
          subject: 'feat(elasticache): add replication group construct',
        },
      ],
    },
  ]);

  assert.match(preview, /## elasticache\/v0\.2\.0/);
  assert.match(preview, /0\.1\.0 -> 0\.2\.0 \(minor\)/);
  assert.match(preview, /feat\(elasticache\): add replication group construct/);
  assert.doesNotMatch(preview, /opensearch/);
});
