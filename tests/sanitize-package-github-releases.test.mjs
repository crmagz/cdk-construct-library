import assert from 'node:assert/strict';
import test from 'node:test';

import {
  packageNameFromReleaseTag,
  packageNamesFromFerrflow,
  sanitizeReleaseBodies,
} from '../scripts/sanitize-package-github-releases.mjs';

const packageNames = new Set(['elasticache', 'opensearch']);

test('reads package names from ferrflow config', () => {
  assert.deepEqual(
    packageNamesFromFerrflow({
      package: [{ name: 'elasticache' }, { name: 'opensearch' }],
    }),
    packageNames,
  );
});

test('detects package names from release tags', () => {
  assert.equal(
    packageNameFromReleaseTag({
      tagName: 'elasticache/v0.1.0',
      packageNames,
    }),
    'elasticache',
  );
  assert.equal(
    packageNameFromReleaseTag({
      tagName: 'v0.1.0',
      packageNames,
    }),
    undefined,
  );
  assert.equal(
    packageNameFromReleaseTag({
      tagName: 'cloudwatch/v0.1.0',
      packageNames,
    }),
    undefined,
  );
});

test('sanitizes package release bodies and ignores non-package releases', () => {
  const updates = sanitizeReleaseBodies({
    packageNames,
    releases: [
      {
        id: 1,
        tag_name: 'elasticache/v0.1.0',
        body: `
## [0.1.0] - 2026-06-20

### Features

- feat(elasticache): add replication group construct
- feat(opensearch): add domain construct
`,
      },
      {
        id: 2,
        tag_name: 'v0.1.0',
        body: '- feat(opensearch): add domain construct',
      },
    ],
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].releaseId, 1);
  assert.equal(updates[0].tagName, 'elasticache/v0.1.0');
  assert.match(updates[0].body, /feat\(elasticache\): add replication group construct/);
  assert.doesNotMatch(updates[0].body, /feat\(opensearch\)/);
  assert.deepEqual(updates[0].removedLines, ['- feat(opensearch): add domain construct']);
});
