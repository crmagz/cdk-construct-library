import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

test('ferrflow release config covers every workspace package', async () => {
  const rootPackage = await readJson('package.json');
  const packageLock = await readJson('package-lock.json');
  const ferrflow = await readJson('ferrflow.json');
  const workspacePattern = rootPackage.workspaces.find((workspace) => workspace === 'packages/*');

  assert.equal(workspacePattern, 'packages/*');
  assert.equal(ferrflow.workspace.branch, 'main');
  assert.equal(ferrflow.workspace.versioning, 'semver');
  assert.equal(ferrflow.workspace.tagTemplate, '{name}/v{version}');
  assert.equal(ferrflow.workspace.recoverMissedReleases, false);
  assert.equal(ferrflow.workspace.releaseCommitScope, 'per-package');

  const packageDirectories = Object.keys(packageLock.packages)
    .filter((packagePath) => /^packages\/[^/]+$/.test(packagePath))
    .map((packagePath) => path.basename(packagePath))
    .sort();

  const configuredPackages = ferrflow.package.map((entry) => entry.name).sort();
  assert.deepEqual(configuredPackages, packageDirectories);

  for (const service of packageDirectories) {
    const workspacePackage = await readJson(`packages/${service}/package.json`);
    const config = ferrflow.package.find((entry) => entry.name === service);

    assert.ok(config, `missing FerrFlow config for ${service}`);
    assert.equal(config.path, `packages/${service}`);
    assert.equal(config.changelog, `packages/${service}/CHANGELOG.md`);
    assert.deepEqual(config.versionedFiles, [
      {
        path: `packages/${service}/package.json`,
        format: 'json',
      },
    ]);
    assert.equal(workspacePackage.name, `@cdk-construct/${service}`);
    const packageBuild =
      service === 'core'
        ? `npm run build --workspace @cdk-construct/${service}`
        : `npm run build --workspace @cdk-construct/core && npm run build --workspace @cdk-construct/${service}`;

    assert.equal(
      config.hooks.preCommit,
      `node scripts/sanitize-ferrflow-changelog.mjs --package ${service} --changelog packages/${service}/CHANGELOG.md`,
    );
    assert.equal(
      config.hooks.prePublish,
      `node scripts/validate-ferrflow-package-release.mjs --package ${service} --changelog packages/${service}/CHANGELOG.md`,
    );
    assert.equal(
      config.hooks.postPublish,
      `node scripts/sanitize-ferrflow-github-release.mjs --package ${service} && ${packageBuild} && npm publish --workspace @cdk-construct/${service} --access public`,
    );
  }
});
