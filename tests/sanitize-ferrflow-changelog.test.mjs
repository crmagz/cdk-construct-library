import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeFerrflowChangelog } from '../scripts/sanitize-ferrflow-changelog.mjs';

const apiGatewayChangelog = `# Changelog

All notable changes to \`api-gateway\` will be documented here.

## [0.1.0] - 2026-06-19

### Features

- feat(api-gateway): split private and regional api constructs
- feat(cloudwatch): add alarm construct
- feat(waf): add web acl construct

### Bug Fixes

- fix(api-gateway): use lambda proxy route

## [0.0.0] - 2026-06-13

### Features

- feat(api-gateway): scaffold workspace package
`;

test('keeps package-scoped release notes and removes other package scopes', () => {
  const sanitized = sanitizeFerrflowChangelog({
    content: apiGatewayChangelog,
    packageName: 'api-gateway',
  });

  assert.match(sanitized.content, /feat\(api-gateway\): split private/);
  assert.match(sanitized.content, /fix\(api-gateway\): use lambda proxy route/);
  assert.doesNotMatch(sanitized.content, /feat\(cloudwatch\)/);
  assert.doesNotMatch(sanitized.content, /feat\(waf\)/);
  assert.deepEqual(sanitized.removedLines, [
    '- feat(cloudwatch): add alarm construct',
    '- feat(waf): add web acl construct',
  ]);
});

test('removes release sections that have no package-scoped notes left', () => {
  const sanitized = sanitizeFerrflowChangelog({
    content: `# Changelog

## [0.4.0] - 2026-06-13

### Features

- feat(sqs): add queue construct

## [0.2.0] - 2026-06-12

### Features

- feat(s3): add bucket construct
`,
    packageName: 's3',
  });

  assert.doesNotMatch(sanitized.content, /\[0\.4\.0\]/);
  assert.match(sanitized.content, /\[0\.2\.0\]/);
  assert.match(sanitized.content, /feat\(s3\): add bucket construct/);
});

test('removes repo maintenance release notes from package changelogs', () => {
  const sanitized = sanitizeFerrflowChangelog({
    content: `# Changelog

## [0.1.0] - 2026-06-12

### Features

- feat(release): replace custom publisher with ferrflow
- feat(s3): scaffold workspace package

### Bug Fixes

- fix(release): configure ferrflow git identity
`,
    packageName: 's3',
  });

  assert.match(sanitized.content, /feat\(s3\): scaffold workspace package/);
  assert.doesNotMatch(sanitized.content, /feat\(release\)/);
  assert.doesNotMatch(sanitized.content, /fix\(release\)/);
  assert.doesNotMatch(sanitized.content, /### Bug Fixes/);
});
