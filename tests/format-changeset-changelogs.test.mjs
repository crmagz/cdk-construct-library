import assert from 'node:assert/strict';
import test from 'node:test';

import { formatChangelog } from '../scripts/format-changeset-changelogs.mjs';

test('formats changeset semver sections into conventional commit categories', () => {
  const source = [
    '# @cdk-construct/eks',
    '',
    '## 0.1.0',
    '',
    '### Major Changes',
    '',
    '- feat(eks)!: replace cluster defaults',
    '',
    '### Minor Changes',
    '',
    '- feat(eks): add cluster construct',
    '',
    '### Patch Changes',
    '',
    '- fix(eks): correct service metadata',
    '- perf(eks): freeze package metadata',
    '- docs(eks): document release preview',
    '- test(eks): validate synthesized resources',
    '- Validate legacy release summary',
    '',
  ].join('\n');

  assert.equal(
    formatChangelog(source),
    [
      '# @cdk-construct/eks',
      '',
      '## 0.1.0',
      '',
      '### Breaking Changes',
      '',
      '- feat(eks)!: replace cluster defaults',
      '',
      '### Features',
      '',
      '- feat(eks): add cluster construct',
      '',
      '### Bug Fixes',
      '',
      '- fix(eks): correct service metadata',
      '',
      '### Performance',
      '',
      '- perf(eks): freeze package metadata',
      '',
      '### Documentation',
      '',
      '- docs(eks): document release preview',
      '',
      '### Tests',
      '',
      '- test(eks): validate synthesized resources',
      '',
      '### Other Changes',
      '',
      '- Validate legacy release summary',
      '',
    ].join('\n'),
  );
});

test('leaves changelog content without changeset semver headings unchanged', () => {
  const source = [
    '# @cdk-construct/core',
    '',
    '## 0.1.0',
    '',
    '### Features',
    '',
    '- feat(core): add environment helpers',
    '',
  ].join('\n');

  assert.equal(formatChangelog(source), source);
});

test('replaces changesets hash summaries with conventional commit subjects when available', () => {
  const source = [
    '# @cdk-construct/eks',
    '',
    '## 0.1.0',
    '',
    '### Minor Changes',
    '',
    '- abc1234: Validate the EKS package changelog and release flow with Changesets.',
    '',
    '### Patch Changes',
    '',
    '- def5678: Freeze the EKS package metadata object.',
    '',
  ].join('\n');

  assert.equal(
    formatChangelog(source, {
      commitSubjects: new Map([
        ['abc1234', 'feat(eks): add workspace package'],
        ['def5678', 'perf(eks): freeze package metadata'],
      ]),
    }),
    [
      '# @cdk-construct/eks',
      '',
      '## 0.1.0',
      '',
      '### Features',
      '',
      '- feat(eks): add workspace package',
      '',
      '### Performance',
      '',
      '- perf(eks): freeze package metadata',
      '',
    ].join('\n'),
  );
});

test('preserves non-generated changelog text after changeset sections', () => {
  const source = [
    '# Changelog',
    '',
    '## 0.2.1',
    '',
    '### Patch Changes',
    '',
    '- abc1234: Validate the SQS package changelog and release flow with Changesets.',
    '',
    'All notable changes to `sqs` will be documented here.',
    '',
    '## [0.1.0] - 2026-06-13',
    '',
    '### Features',
    '',
    '- feat(sqs): add queue construct',
    '',
  ].join('\n');

  assert.equal(
    formatChangelog(source),
    [
      '# Changelog',
      '',
      '## 0.2.1',
      '',
      '### Other Changes',
      '',
      '- abc1234: Validate the SQS package changelog and release flow with Changesets.',
      '',
      'All notable changes to `sqs` will be documented here.',
      '',
      '## [0.1.0] - 2026-06-13',
      '',
      '### Features',
      '',
      '- feat(sqs): add queue construct',
      '',
    ].join('\n'),
  );
});
