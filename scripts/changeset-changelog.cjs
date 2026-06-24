'use strict';

const { execFile } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const conventionalCommitPattern = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+/;
const githubNoreplyPattern = /^(?:\d+\+)?(?<slug>[^@]+)@users\.noreply\.github\.com$/;

const normalizeRepositoryUrl = (url) =>
  url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? undefined;

const getRepositoryUrl = () => {
  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );

    return normalizeRepositoryUrl(packageJson.repository?.url);
  } catch {
    return undefined;
  }
};

const repositoryUrl = getRepositoryUrl();

const packageScope = (packageName) => packageName.replace(/^@cdk-construct\//, '');

const releaseScopes = (changeset) =>
  new Set(changeset.releases.map((release) => packageScope(release.name)));

const isPackageScopedCommit = (subject, changeset) => {
  const match = conventionalCommitPattern.exec(subject);

  if (!match?.groups?.scope) {
    return false;
  }

  return releaseScopes(changeset).has(match.groups.scope);
};

const parseAuthorSlug = ({ authorEmail, authorName }) => {
  const emailMatch = githubNoreplyPattern.exec(authorEmail ?? '');

  if (emailMatch?.groups?.slug) {
    return emailMatch.groups.slug;
  }

  if (authorName?.startsWith('@')) {
    return authorName.slice(1);
  }

  return undefined;
};

const formatAuthor = (metadata) => {
  const authorSlug = parseAuthorSlug(metadata);

  if (!authorSlug) {
    return metadata.authorName ? ` by ${metadata.authorName}` : '';
  }

  return ` by [@${authorSlug}](https://github.com/${authorSlug})`;
};

const formatCommit = (metadata) => {
  if (!metadata.shortHash) {
    return '';
  }

  if (!repositoryUrl) {
    return ` (${metadata.shortHash})`;
  }

  return ` ([${metadata.shortHash}](${repositoryUrl}/commit/${metadata.fullHash}))`;
};

const getCommitMetadata = async (commit) => {
  try {
    const { stdout } = await execFileAsync('git', [
      'log',
      '-1',
      '--format=%H%x00%h%x00%s%x00%an%x00%ae',
      commit,
    ]);
    const [fullHash, shortHash, subject, authorName, authorEmail] = stdout.trim().split('\0');

    return {
      authorEmail,
      authorName,
      fullHash,
      shortHash,
      subject,
    };
  } catch {
    return undefined;
  }
};

const selectFirstLine = async (changeset) => {
  const [firstLine, ...futureLines] = changeset.summary
    .trim()
    .split('\n')
    .map((line) => line.trimEnd());

  if (changeset.commit) {
    const metadata = await getCommitMetadata(changeset.commit);

    if (metadata?.subject && isPackageScopedCommit(metadata.subject, changeset)) {
      return {
        firstLine: metadata.subject,
        futureLines,
        metadata,
      };
    }
  }

  return {
    firstLine,
    futureLines,
  };
};

const getReleaseLine = async (changeset) => {
  const { firstLine, futureLines, metadata } = await selectFirstLine(changeset);

  if (!firstLine) {
    return '';
  }

  const body = futureLines.map((line) => `  ${line}`).join('\n');
  const suffix = metadata ? `${formatCommit(metadata)}${formatAuthor(metadata)}` : '';
  return [`- ${firstLine}${suffix}`, body].filter(Boolean).join('\n');
};

const getDependencyReleaseLine = async (_changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) {
    return '';
  }

  const dependencies = dependenciesUpdated
    .map((dependency) => `  - ${dependency.name}@${dependency.newVersion}`)
    .join('\n');

  return `- chore(deps): update internal workspace dependencies\n${dependencies}`;
};

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
