#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const releasableTypes = new Set(['feat', 'fix', 'perf', 'refactor']);
const typeHeadings = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
};
const defaultFerrFlowVersion = '5.2.4';
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

    if (arg === '--ferrflow-version') {
      options.ferrFlowVersion = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--skip-ferrflow-plan') {
      options.skipFerrFlowPlan = true;
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

export const bumpVersion = ({ version, bump }) => {
  const [major, minor, patch] = version.split('.').map((part) => Number(part));

  if ([major, minor, patch].some((part) => !Number.isInteger(part))) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }

  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
};

const bumpForCommit = (commit) => {
  if (commit.breaking) {
    return 'major';
  }

  if (commit.type === 'feat') {
    return 'minor';
  }

  return 'patch';
};

const maxBump = (current, next) => {
  const rank = { none: 0, patch: 1, minor: 2, major: 3 };

  return rank[next] > rank[current] ? next : current;
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

const commitsFromGit = ({ base, head = 'HEAD' }) => {
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

export const releasePreviewsFromCommits = ({ commits, packageNames, packageVersions }) => {
  const packageNameSet = new Set(packageNames);
  const previews = new Map();

  for (const commit of commits) {
    const parsed = parseConventionalSubject(commit.subject);

    if (parsed === undefined || !releasableTypes.has(parsed.type) || parsed.scope === undefined) {
      continue;
    }

    if (!packageNameSet.has(parsed.scope)) {
      continue;
    }

    const changedPackagePaths = packagePathsFromFiles(commit.files);
    const touchesScopedPackage = commit.files.some((file) =>
      file.startsWith(`packages/${parsed.scope}/`),
    );
    const touchesOtherPackage = changedPackagePaths.some(
      (packageName) => packageName !== parsed.scope,
    );

    if (!touchesScopedPackage || touchesOtherPackage) {
      continue;
    }

    const preview = previews.get(parsed.scope) ?? {
      packageName: parsed.scope,
      currentVersion: packageVersions[parsed.scope],
      bump: 'none',
      commits: [],
    };

    preview.bump = maxBump(preview.bump, bumpForCommit(parsed));
    preview.commits.push({
      hash: commit.hash,
      type: parsed.type,
      subject: commit.subject,
    });
    previews.set(parsed.scope, preview);
  }

  return [...previews.values()].map((preview) => ({
    ...preview,
    nextVersion: bumpVersion({
      version: preview.currentVersion,
      bump: preview.bump === 'none' ? 'patch' : preview.bump,
    }),
  }));
};

const ferrFlowCommitSubject = (commit) => {
  if (typeof commit === 'string') {
    return commit;
  }

  return commit.subject ?? commit.message ?? commit.summary ?? commit.header;
};

const ferrFlowCommitHash = (commit) => {
  if (typeof commit === 'string') {
    return undefined;
  }

  return commit.hash ?? commit.sha ?? commit.id;
};

export const validateFerrFlowPackageScopedPlan = ({ packages, packageNames }) => {
  const packageNameSet = new Set(packageNames);
  const errors = [];

  for (const releasePackage of packages) {
    const packageName =
      releasePackage.name ?? releasePackage.packageName ?? releasePackage.package?.name;

    if (!packageNameSet.has(packageName)) {
      continue;
    }

    for (const commit of releasePackage.commits ?? []) {
      const subject = ferrFlowCommitSubject(commit);

      if (subject === undefined) {
        continue;
      }

      const parsed = parseConventionalSubject(subject);
      const isBreaking = parsed?.breaking === true;
      const isReleasable = parsed !== undefined && releasableTypes.has(parsed.type);

      if (!isReleasable && !isBreaking) {
        continue;
      }

      const hash = ferrFlowCommitHash(commit);
      const prefix = hash === undefined ? subject : `${hash.slice(0, 7)} "${subject}"`;

      if (parsed === undefined || parsed.scope === undefined) {
        errors.push(
          `${packageName} release includes ${prefix}, but releasable release notes must use a package scope.`,
        );
        continue;
      }

      if (parsed.scope !== packageName) {
        errors.push(
          `${packageName} release includes out-of-scope commit ${prefix}; expected scope "${packageName}", got "${parsed.scope}".`,
        );
      }
    }
  }

  return errors;
};

const ferrFlowPlanFromCheck = ({ ferrFlowVersion = defaultFerrFlowVersion } = {}) => {
  const output = execFileSync(
    'npx',
    [
      '-p',
      `@ferrlabs/ferrflow@${ferrFlowVersion}`,
      'ferrflow',
      'check',
      '--config',
      'ferrflow.json',
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();

  return output.length === 0 ? { packages: [] } : JSON.parse(output);
};

export const validateCurrentFerrFlowPlan = ({ ferrFlowVersion } = {}) => {
  const ferrflowConfig = readJson('ferrflow.json');
  const packageNames = packageNamesFromFerrflow(ferrflowConfig);
  const plan = ferrFlowPlanFromCheck({ ferrFlowVersion });

  return validateFerrFlowPackageScopedPlan({
    packages: plan.packages ?? [],
    packageNames,
  });
};

export const renderReleasePreviews = (previews) => {
  if (previews.length === 0) {
    return 'No package releases would be created from this change.\n';
  }

  const lines = ['Package release preview', ''];

  for (const preview of previews) {
    lines.push(`## ${preview.packageName}/v${preview.nextVersion}`);
    lines.push('');
    lines.push(`${preview.currentVersion} -> ${preview.nextVersion} (${preview.bump})`);
    lines.push('');

    for (const type of Object.keys(typeHeadings)) {
      const commits = preview.commits.filter((commit) => commit.type === type);

      if (commits.length === 0) {
        continue;
      }

      lines.push(`### ${typeHeadings[type]}`);
      lines.push('');

      for (const commit of commits) {
        lines.push(`- ${commit.subject} (${commit.hash})`);
      }

      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
};

const defaultBaseRef = () => {
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  return 'origin/main';
};

export const previewCurrentBranch = ({ base = defaultBaseRef(), head = 'HEAD' } = {}) => {
  const ferrflowConfig = readJson('ferrflow.json');
  const packageNames = packageNamesFromFerrflow(ferrflowConfig);
  const packageVersions = Object.fromEntries(
    packageNames.map((packageName) => [
      packageName,
      readJson(`packages/${packageName}/package.json`).version,
    ]),
  );
  const commits = commitsFromGit({ base, head });

  return releasePreviewsFromCommits({
    commits,
    packageNames,
    packageVersions,
  });
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const previews = previewCurrentBranch(options);

  console.log(renderReleasePreviews(previews));

  if (options.skipFerrFlowPlan === true) {
    return;
  }

  const errors = validateCurrentFerrFlowPlan({
    ferrFlowVersion: options.ferrFlowVersion,
  });

  if (errors.length === 0) {
    console.log('FerrFlow release plan is package-scoped.');
    return;
  }

  console.error('FerrFlow release plan contains out-of-scope package release notes.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
