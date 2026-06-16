#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const releasableTypes = new Set(['feat', 'fix', 'perf', 'refactor']);
const conventionalSubjectPattern =
  /^(?<type>[a-z]+)(?<typeBreaking>!)?(?:\((?<scope>[^)]+)\))?(?<scopeBreaking>!)?: (?<description>.+)$/;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const parseArgs = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--base') {
      options.base = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--head') {
      options.head = args[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
};

const runGit = (args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

export const parseConventionalSubject = (subject) => {
  const match = subject.match(conventionalSubjectPattern);

  if (!match?.groups) {
    return undefined;
  }

  return {
    type: match.groups.type,
    scope: match.groups.scope,
    breaking: match.groups.typeBreaking === '!' || match.groups.scopeBreaking === '!',
    description: match.groups.description,
  };
};

export const packageNamesFromFerrflow = (ferrflowConfig) =>
  ferrflowConfig.package.map((workspacePackage) => workspacePackage.name).sort();

const packagePathsFromFiles = (files) =>
  [
    ...new Set(
      files
        .map((file) => file.match(/^packages\/([^/]+)\//)?.[1])
        .filter((packageName) => packageName !== undefined),
    ),
  ].sort();

export const validateReleaseScopeCommits = ({ commits, packageNames }) => {
  const packageNameSet = new Set(packageNames);
  const errors = [];

  for (const commit of commits) {
    const parsed = parseConventionalSubject(commit.subject);
    const isBreaking = parsed?.breaking === true;
    const isReleasable = parsed !== undefined && releasableTypes.has(parsed.type);

    if (!isReleasable && !isBreaking) {
      continue;
    }

    if (parsed === undefined) {
      errors.push(
        `${commit.hash} "${commit.subject}" is release-relevant but is not a valid conventional commit subject.`,
      );
      continue;
    }

    if (parsed.scope === undefined) {
      errors.push(
        `${commit.hash} "${commit.subject}" uses a releasable type without a package scope. Use a package scope like feat(s3) or a non-releasable type like ci(release) for repo-only changes.`,
      );
      continue;
    }

    if (!packageNameSet.has(parsed.scope)) {
      errors.push(
        `${commit.hash} "${commit.subject}" uses releasable scope "${parsed.scope}", but that is not a configured package. Use one of: ${packageNames.join(', ')}.`,
      );
      continue;
    }

    const changedPackagePaths = packagePathsFromFiles(commit.files);
    const expectedPackagePath = `packages/${parsed.scope}/`;
    const touchesScopedPackage = commit.files.some((file) => file.startsWith(expectedPackagePath));
    const otherPackagePaths = changedPackagePaths.filter(
      (packageName) => packageName !== parsed.scope,
    );

    if (!touchesScopedPackage) {
      errors.push(
        `${commit.hash} "${commit.subject}" is scoped to "${parsed.scope}" but does not touch ${expectedPackagePath}.`,
      );
    }

    if (otherPackagePaths.length > 0) {
      errors.push(
        `${commit.hash} "${commit.subject}" is scoped to "${parsed.scope}" but also touches other package directories: ${otherPackagePaths.join(', ')}.`,
      );
    }
  }

  return errors;
};

const defaultBaseRef = () => {
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  return 'origin/main';
};

const commitsFromGit = ({ base = defaultBaseRef(), head = 'HEAD' }) => {
  const mergeBase = runGit(['merge-base', base, head]);
  const log = runGit(['log', '--reverse', '--format=%H%x00%s', `${mergeBase}..${head}`]);

  if (log.length === 0) {
    return [];
  }

  return log.split('\n').map((line) => {
    const [hash, subject] = line.split('\0');
    const files = runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', hash])
      .split('\n')
      .filter((file) => file.length > 0);

    return { hash: hash.slice(0, 7), subject, files };
  });
};

export const validateCurrentBranch = ({ base, head } = {}) => {
  const ferrflowConfig = readJson('ferrflow.json');
  const packageNames = packageNamesFromFerrflow(ferrflowConfig);
  const commits = commitsFromGit({ base, head });

  return validateReleaseScopeCommits({ commits, packageNames });
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const errors = validateCurrentBranch(options);

  if (errors.length === 0) {
    console.log('Release-scoped conventional commits are aligned with package paths.');
    return;
  }

  console.error('Release-scoped conventional commits must target matching package paths.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
