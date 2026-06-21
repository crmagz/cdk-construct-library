import assert from 'node:assert/strict';
import test from 'node:test';

import {
  githubApiRequestOptions,
  releaseByTagPath,
  releasePatchPath,
  resolveGithubReleaseOptions,
  sanitizeGithubReleaseBody,
} from '../scripts/sanitize-ferrflow-github-release.mjs';

const releaseBody = `
## [0.1.0] - 2026-06-20

### Features

- feat(opensearch): add domain construct
- feat(api-gateway): add rest api construct
- feat(waf): add web acl construct

### Bug Fixes

- fix(opensearch): require production vpc placement
- fix(api-gateway): use lambda proxy route
`;

test('sanitizes GitHub release bodies to the current package scope', () => {
  const sanitized = sanitizeGithubReleaseBody({
    body: releaseBody,
    packageName: 'opensearch',
  });

  assert.match(sanitized.content, /feat\(opensearch\): add domain construct/);
  assert.match(sanitized.content, /fix\(opensearch\): require production vpc placement/);
  assert.doesNotMatch(sanitized.content, /feat\(api-gateway\)/);
  assert.doesNotMatch(sanitized.content, /feat\(waf\)/);
  assert.deepEqual(sanitized.removedLines, [
    '- feat(api-gateway): add rest api construct',
    '- feat(waf): add web acl construct',
    '- fix(api-gateway): use lambda proxy route',
  ]);
});

test('keeps an explicit empty-release message when all notes are out of scope', () => {
  const sanitized = sanitizeGithubReleaseBody({
    body: releaseBody,
    packageName: 'cloudfront',
  });

  assert.equal(sanitized.content, '\n## [0.1.0] - 2026-06-20\n\nNo package-scoped changes.\n');
  assert.equal(sanitized.removedLines.length, 5);
});

test('resolves release sanitizer options from FerrFlow and GitHub environment', () => {
  const options = resolveGithubReleaseOptions(
    {},
    {
      FERRFLOW_PACKAGE: 'opensearch',
      FERRFLOW_TAG: 'opensearch/v0.1.0',
      GITHUB_REPOSITORY: 'crmagz/cdk-construct-library',
      GITHUB_TOKEN: 'token',
    },
  );

  assert.deepEqual(options, {
    packageName: 'opensearch',
    tag: 'opensearch/v0.1.0',
    repo: 'crmagz/cdk-construct-library',
    token: 'token',
  });
});

test('builds GitHub API request paths for slash-delimited package tags', () => {
  assert.equal(releaseByTagPath('opensearch/v0.1.0'), '/releases/tags/opensearch%2Fv0.1.0');
  assert.equal(releasePatchPath(342409678), '/releases/342409678');

  assert.deepEqual(
    githubApiRequestOptions({
      method: 'PATCH',
      repo: 'crmagz/cdk-construct-library',
      path: releasePatchPath(342409678),
      token: 'token',
    }),
    {
      hostname: 'api.github.com',
      method: 'PATCH',
      path: '/repos/crmagz/cdk-construct-library/releases/342409678',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer token',
        'User-Agent': 'cdk-construct-library-release-sanitizer',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
});
