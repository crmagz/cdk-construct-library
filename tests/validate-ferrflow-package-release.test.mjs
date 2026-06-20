import assert from 'node:assert/strict';
import test from 'node:test';

import {
  releaseSectionForVersion,
  releaseSectionHasPackageNotes,
  validatePackageReleaseNotes,
} from '../scripts/validate-ferrflow-package-release.mjs';

const changelog = `# Changelog

## [0.2.0] - 2026-06-20

### Features

- feat(opensearch): add domain construct

### Bug Fixes

- fix(opensearch): require production vpc placement

## [0.1.0] - 2026-06-19

### Features

- feat(opensearch): add workspace package
`;

test('extracts a release section by version', () => {
  const section = releaseSectionForVersion({
    content: changelog,
    version: '0.2.0',
  });

  assert.match(section, /feat\(opensearch\): add domain construct/);
  assert.doesNotMatch(section, /\[0\.1\.0\]/);
});

test('detects package-scoped conventional commit entries', () => {
  const section = releaseSectionForVersion({
    content: changelog,
    version: '0.2.0',
  });

  assert.equal(
    releaseSectionHasPackageNotes({
      section,
      packageName: 'opensearch',
    }),
    true,
  );
  assert.equal(
    releaseSectionHasPackageNotes({
      section,
      packageName: 'api-gateway',
    }),
    false,
  );
});

test('allows a package release with package-scoped notes', () => {
  const errors = validatePackageReleaseNotes({
    content: changelog,
    packageName: 'opensearch',
    version: '0.2.0',
  });

  assert.deepEqual(errors, []);
});

test('rejects a release with only another package scope', () => {
  const errors = validatePackageReleaseNotes({
    content: changelog,
    packageName: 'api-gateway',
    version: '0.2.0',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /no api-gateway-scoped conventional commit entries/);
});

test('rejects a selected package when sanitized notes removed the release section', () => {
  const errors = validatePackageReleaseNotes({
    content: changelog,
    packageName: 'opensearch',
    version: '0.3.0',
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Missing opensearch release notes for version 0\.3\.0/);
});
