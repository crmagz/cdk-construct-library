import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const packageName = mustGetEnv('PACKAGE_NAME');
const packageDir = mustGetEnv('PACKAGE_DIR');
const tagPrefix = mustGetEnv('RELEASE_TAG_PREFIX');
const scope = mustGetEnv('COMMIT_SCOPE');
const distDir = 'dist';
const jsDistDir = join(distDir, 'js');
const npmCacheDir = '.npm-cache';
const releaseTagFile = join(distDir, 'releasetag.txt');
const changelogFile = join(distDir, 'changelog.md');
const versionFile = join(distDir, 'version.txt');
const packageJsonFile = join(packageDir, 'package.json');

mkdirSync(jsDistDir, { recursive: true });
mkdirSync(join(npmCacheDir, '_logs'), { recursive: true });

const latestTag = findLatestTag(tagPrefix);
const baseVersion = latestTag ? versionFromTag(latestTag, tagPrefix) : '0.0.0';
const commits = findScopedCommits(latestTag, scope);
const bump = determineBump(commits);

if (bump === 'none') {
  console.log(`No releasable ${scope} commits found.`);
  writeFileSync(releaseTagFile, '');
  writeFileSync(versionFile, baseVersion);
  writeFileSync(changelogFile, `# ${packageName}\n\nNo releasable changes.\n`);
  process.exit(0);
}

const nextVersion = bumpVersion(baseVersion, bump);
const releaseTag = `${tagPrefix}v${nextVersion}`;

console.log(`Releasing ${packageName} ${nextVersion} from ${commits.length} commit(s).`);
updatePackageVersion(packageJsonFile, nextVersion);

writeFileSync(versionFile, nextVersion);
writeFileSync(releaseTagFile, releaseTag);
writeFileSync(changelogFile, renderChangelog(packageName, nextVersion, commits));

runNpm(['run', 'build', '--workspace', packageName]);
runNpm(['pack', '--workspace', packageName, '--pack-destination', jsDistDir]);

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function runNpm(args) {
  execFileSync('npm', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
      NPM_CONFIG_LOGS_DIR: join(npmCacheDir, '_logs'),
    },
  });
}

function findLatestTag(prefix) {
  const pattern = `${prefix}v*`;
  try {
    const tags = run('git', ['tag', '--sort=-version:refname', '--list', pattern]);
    return tags.split('\n').find(Boolean);
  } catch {
    return undefined;
  }
}

function versionFromTag(tag, prefix) {
  return tag.slice(prefix.length + 1);
}

function findScopedCommits(tag, commitScope) {
  const range = tag ? [`${tag}..HEAD`] : [];
  const output = run('git', ['log', '--format=%H%x00%s', ...range]);
  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => {
      const [hash, subject] = line.split('\0');
      return { hash, subject };
    })
    .filter((commit) => isScopedConventionalCommit(commit.subject, commitScope));
}

function isScopedConventionalCommit(subject, commitScope) {
  const match = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/);
  if (!match) {
    return false;
  }
  const [, type, parsedScope] = match;
  return parsedScope === commitScope && ['feat', 'fix', 'perf'].includes(type);
}

function determineBump(commits) {
  if (commits.length === 0) {
    return 'none';
  }
  if (commits.some(({ subject }) => subject.includes('!:'))) {
    return 'major';
  }
  if (commits.some(({ subject }) => subject.startsWith('feat('))) {
    return 'minor';
  }
  return 'patch';
}

function bumpVersion(version, bump) {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  const [major, minor, patch] = parts.length === 3 ? parts : [0, 0, 0];

  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function updatePackageVersion(file, version) {
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist`);
  }
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.version = version;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(json, undefined, 2)}\n`);
}

function renderChangelog(name, version, commits) {
  const lines = [`# ${name} ${version}`, ''];
  for (const commit of commits) {
    lines.push(`- ${commit.subject} (${commit.hash.slice(0, 7)})`);
  }
  lines.push('');
  return lines.join('\n');
}
