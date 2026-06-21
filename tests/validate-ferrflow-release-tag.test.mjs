import assert from 'node:assert/strict';
import test from 'node:test';

import {
  releaseTagExists,
  releaseTagName,
  validateReleaseTagDoesNotExist,
} from '../scripts/validate-ferrflow-release-tag.mjs';

test('builds package release tags from package and version', () => {
  assert.equal(
    releaseTagName({
      packageName: 'bedrock',
      version: '0.1.0',
    }),
    'bedrock/v0.1.0',
  );
});

test('uses an explicit FerrFlow tag when provided', () => {
  assert.equal(
    releaseTagName({
      packageName: 'bedrock',
      version: '0.1.0',
      tag: 'custom/v1.2.3',
    }),
    'custom/v1.2.3',
  );
});

test('detects existing package release tags', () => {
  assert.equal(
    releaseTagExists({
      tagName: 'bedrock/v0.1.0',
      existingTags: ['core/v0.3.0', 'bedrock/v0.1.0'],
    }),
    true,
  );
});

test('rejects planned package release tags that already exist', () => {
  const errors = validateReleaseTagDoesNotExist({
    tagName: 'bedrock/v0.1.0',
    existingTags: ['bedrock/v0.1.0'],
  });

  assert.deepEqual(errors, ['Refusing to release bedrock/v0.1.0 because the tag already exists.']);
});

test('allows planned package release tags that do not exist', () => {
  assert.deepEqual(
    validateReleaseTagDoesNotExist({
      tagName: 'bedrock/v0.1.0',
      existingTags: ['bedrock/v0.0.0'],
    }),
    [],
  );
});
