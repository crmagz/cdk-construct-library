#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const parseArgs = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--package') {
      options.packageName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--version') {
      options.version = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--changelog') {
      options.changelog = args[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const releaseSectionForVersion = ({ content, version }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line.startsWith(heading));

  if (start === -1) {
    return undefined;
  }

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## ['));

  return lines.slice(start, end === -1 ? undefined : end).join('\n');
};

export const releaseSectionHasPackageNotes = ({ section, packageName }) => {
  const packageBulletPattern = new RegExp(
    `^- [a-z]+!?(?:\\(${escapeRegExp(packageName)}\\))!?: .+$`,
    'm',
  );

  return packageBulletPattern.test(section);
};

export const validatePackageReleaseNotes = ({ content, packageName, version }) => {
  const section = releaseSectionForVersion({ content, version });

  if (section === undefined) {
    return [
      `Missing ${packageName} release notes for version ${version}. FerrFlow selected the package, but the sanitized changelog has no release section for that version.`,
    ];
  }

  if (!releaseSectionHasPackageNotes({ section, packageName })) {
    return [
      `${packageName} release ${version} has no ${packageName}-scoped conventional commit entries. Refusing to publish a package release with only cross-package or repo-maintenance notes.`,
    ];
  }

  return [];
};

const resolveOptions = (options, env = process.env) => {
  const packageName = options.packageName ?? env.FERRFLOW_PACKAGE;
  const version = options.version ?? env.FERRFLOW_NEW_VERSION;
  const packagePath = env.FERRFLOW_PACKAGE_PATH;
  const changelog =
    options.changelog ??
    (packagePath === undefined ? undefined : path.join(packagePath, 'CHANGELOG.md'));

  if (packageName === undefined || version === undefined || changelog === undefined) {
    throw new Error(
      'Expected --package, --version, and --changelog, or FERRFLOW_PACKAGE, FERRFLOW_NEW_VERSION, and FERRFLOW_PACKAGE_PATH.',
    );
  }

  return { packageName, version, changelog };
};

const main = () => {
  const options = resolveOptions(parseArgs(process.argv.slice(2)));
  const content = readFileSync(options.changelog, 'utf8');
  const errors = validatePackageReleaseNotes({
    content,
    packageName: options.packageName,
    version: options.version,
  });

  if (errors.length === 0) {
    return;
  }

  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
