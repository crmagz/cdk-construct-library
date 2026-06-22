'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const conventionalCommitPattern = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+/;

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

const getCommitSubject = async (commit) => {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%s', commit]);
    return stdout.trim();
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
    const commitSubject = await getCommitSubject(changeset.commit);

    if (commitSubject && isPackageScopedCommit(commitSubject, changeset)) {
      return {
        firstLine: commitSubject,
        futureLines,
      };
    }
  }

  return {
    firstLine,
    futureLines,
  };
};

const getReleaseLine = async (changeset) => {
  const { firstLine, futureLines } = await selectFirstLine(changeset);

  if (!firstLine) {
    return '';
  }

  const body = futureLines.map((line) => `  ${line}`).join('\n');
  return [`- ${firstLine}`, body].filter(Boolean).join('\n');
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
