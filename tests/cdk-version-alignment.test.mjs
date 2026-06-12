import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const expected = {
  awsCdkCli: '2.1126.0',
  awsCdkLib: '2.236.0',
  awsCdkLibPeer: '^2.236.0',
  constructs: '10.4.0',
  constructsPeer: '^10.4.0',
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

test('root package pins the shared CDK toolchain versions', async () => {
  const rootPackage = await readJson('package.json');

  assert.equal(rootPackage.devDependencies['aws-cdk'], expected.awsCdkCli);
  assert.equal(rootPackage.devDependencies['aws-cdk-lib'], expected.awsCdkLib);
  assert.equal(rootPackage.devDependencies.constructs, expected.constructs);
  assert.equal(rootPackage.peerDependencies['aws-cdk-lib'], expected.awsCdkLibPeer);
  assert.equal(rootPackage.peerDependencies.constructs, expected.constructsPeer);
});

test('workspace packages use the shared CDK dependency versions', async () => {
  const packageLock = await readJson('package-lock.json');
  const workspacePackagePaths = Object.keys(packageLock.packages)
    .filter((packagePath) => /^packages\/[^/]+$/.test(packagePath))
    .sort();

  for (const packagePath of workspacePackagePaths) {
    const packageJson = await readJson(`${packagePath}/package.json`);

    assert.equal(
      packageJson.peerDependencies['aws-cdk-lib'],
      expected.awsCdkLibPeer,
      `${packagePath} aws-cdk-lib peer dependency drifted`,
    );
    assert.equal(
      packageJson.peerDependencies.constructs,
      expected.constructsPeer,
      `${packagePath} constructs peer dependency drifted`,
    );
    assert.equal(
      packageJson.devDependencies['aws-cdk-lib'],
      expected.awsCdkLib,
      `${packagePath} aws-cdk-lib dev dependency drifted`,
    );
    assert.equal(
      packageJson.devDependencies.constructs,
      expected.constructs,
      `${packagePath} constructs dev dependency drifted`,
    );
  }
});
