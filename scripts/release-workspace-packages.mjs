import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const packageRoot = join(root, 'packages');
const dryRun = process.env.DRY_RUN === 'true';

export const releaseTypes = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

function exec(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: process.env,
  }).trim();
}

function run(command, args, options = {}) {
  const rendered = [command, ...args].join(' ');
  console.log(`$ ${rendered}`);

  if (dryRun && options.skipOnDryRun !== false) {
    console.log(`dry-run: skipped ${rendered}`);
    return;
  }

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${rendered} exited with ${result.status}`);
  }
}

export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported semver version: ${version}`);
  }

  return match.slice(1).map((part) => Number(part));
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }

  return 0;
}

export function incrementVersion(version, releaseType) {
  const [major, minor, patch] = parseVersion(version);

  if (releaseType === 'major') {
    return `${major + 1}.0.0`;
  }

  if (releaseType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  if (releaseType === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  throw new Error(`Unsupported release type: ${releaseType}`);
}

export function serviceName(packageName) {
  const prefix = '@cdk-construct/';

  if (!packageName.startsWith(prefix)) {
    throw new Error(`Unexpected package name: ${packageName}`);
  }

  return packageName.slice(prefix.length);
}

function getWorkspacePackages() {
  return readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(packageRoot, entry.name, 'package.json')))
    .map((entry) => {
      const directory = join(packageRoot, entry.name);
      const packageJsonPath = join(directory, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      return {
        directory,
        packageJson,
        packageJsonPath,
        relativePath: `packages/${entry.name}`,
        service: serviceName(packageJson.name),
      };
    })
    .sort((left, right) => left.packageJson.name.localeCompare(right.packageJson.name));
}

function latestTag(service) {
  const tags = exec('git', ['tag', '--list', `${service}/v*`, '--sort=-v:refname']);
  return tags.split('\n').find(Boolean);
}

export function tagVersion(tag) {
  const match = tag?.match(/\/v(\d+\.\d+\.\d+)$/);
  return match?.[1];
}

function npmLatestVersion(packageName) {
  try {
    return exec('npm', ['view', packageName, 'version']);
  } catch (error) {
    return undefined;
  }
}

function npmVersionExists(packageName, version) {
  try {
    exec('npm', ['view', `${packageName}@${version}`, 'version']);
    return true;
  } catch (error) {
    return false;
  }
}

function baseVersion(workspace, latestServiceTag) {
  const candidates = [workspace.packageJson.version];
  const versionFromTag = tagVersion(latestServiceTag);
  const versionFromNpm = npmLatestVersion(workspace.packageJson.name);

  if (versionFromTag) {
    candidates.push(versionFromTag);
  }

  if (versionFromNpm) {
    candidates.push(versionFromNpm);
  }

  return candidates.sort(compareVersions).at(-1);
}

function commitsForPackage(relativePath, latestServiceTag) {
  const args = ['log'];

  if (latestServiceTag) {
    args.push(`${latestServiceTag}..HEAD`);
  }

  args.push('--format=%H%x1f%s%x1f%b%x1e', '--', relativePath);
  const output = exec('git', args);

  if (!output) {
    return [];
  }

  return output
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ''] = entry.split('\x1f');
      return { hash, subject, body };
    });
}

export function releaseTypeForCommit(commit) {
  const header = commit.subject.match(/^(\w+)(!)?(?:\(([^)]+)\))?(!)?:\s+(.+)$/);

  if (commit.body.includes('BREAKING CHANGE') || header?.[2] || header?.[4]) {
    return 'major';
  }

  if (!header) {
    return 'none';
  }

  const type = header[1];

  if (type === 'feat') {
    return 'minor';
  }

  if (type === 'fix' || type === 'perf') {
    return 'patch';
  }

  return 'none';
}

export function releaseTypeForCommits(commits) {
  return commits.reduce((current, commit) => {
    const next = releaseTypeForCommit(commit);
    return releaseTypes[next] > releaseTypes[current] ? next : current;
  }, 'none');
}

export function releaseNotes(workspace, version, commits) {
  const lines = [
    `## ${workspace.packageJson.name} ${version}`,
    '',
    '### Changes',
    '',
    ...commits.map((commit) => `- ${commit.subject} (${commit.hash.slice(0, 7)})`),
    '',
  ];

  return lines.join('\n');
}

function writePackageVersion(workspace, version) {
  const updated = {
    ...workspace.packageJson,
    version,
  };

  writeFileSync(workspace.packageJsonPath, `${JSON.stringify(updated, null, 2)}\n`);
  workspace.packageJson = updated;
}

function tagExists(tag) {
  try {
    exec('git', ['rev-parse', '--verify', `refs/tags/${tag}`]);
    return true;
  } catch (error) {
    return false;
  }
}

function publishRelease(workspace, version, commits) {
  const tag = `${workspace.service}/v${version}`;

  if (tagExists(tag)) {
    throw new Error(`Release tag already exists: ${tag}`);
  }

  const notesPath = join(mkdtempSync(join(tmpdir(), 'cdk-construct-release-')), 'notes.md');
  writeFileSync(notesPath, releaseNotes(workspace, version, commits));

  if (dryRun) {
    console.log(`dry-run: would release ${workspace.packageJson.name}@${version} as ${tag}`);
    console.log(readFileSync(notesPath, 'utf8'));
    return;
  }

  writePackageVersion(workspace, version);
  run('npm', ['run', 'build', '--workspace', workspace.packageJson.name], { skipOnDryRun: false });

  if (npmVersionExists(workspace.packageJson.name, version)) {
    console.log(
      `${workspace.packageJson.name}@${version} already exists on npm; creating tag only`,
    );
  } else {
    run('npm', ['publish', '--workspace', workspace.packageJson.name, '--access', 'public']);
  }

  run('git', ['tag', '-a', tag, '-m', `chore(release): ${tag}`]);
  run('git', ['push', 'origin', tag]);
  run('gh', [
    'release',
    'create',
    tag,
    '--title',
    tag,
    '--notes-file',
    notesPath,
    '--target',
    'HEAD',
  ]);
}

export function createReleasePlan(
  workspaces,
  {
    latestTagForService = latestTag,
    commitsForPackagePath = commitsForPackage,
    baseVersionForWorkspace = baseVersion,
    log = console.log,
  } = {},
) {
  const releasable = [];

  for (const workspace of workspaces) {
    if (!existsSync(workspace.directory)) {
      continue;
    }

    const tag = latestTagForService(workspace.service);
    const commits = commitsForPackagePath(workspace.relativePath, tag);
    const releaseType = releaseTypeForCommits(commits);

    if (releaseType === 'none') {
      log(`${workspace.packageJson.name}: no releasable commits`);
      continue;
    }

    const fromVersion = baseVersionForWorkspace(workspace, tag);
    const toVersion = incrementVersion(fromVersion, releaseType);
    releasable.push({ commits, fromVersion, releaseType, toVersion, workspace });

    log(`${workspace.packageJson.name}: ${releaseType} release ${fromVersion} -> ${toVersion}`);
  }

  return releasable;
}

export function main() {
  const releasable = createReleasePlan(getWorkspacePackages());

  if (releasable.length === 0) {
    console.log('No workspace packages have releasable conventional commits.');
    return;
  }

  for (const release of releasable) {
    publishRelease(release.workspace, release.toVersion, release.commits);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
