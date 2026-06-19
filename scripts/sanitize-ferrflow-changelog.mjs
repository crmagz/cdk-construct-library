#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const conventionalBulletPattern =
  /^- (?<type>[a-z]+)(?<typeBreaking>!)?(?:\((?<scope>[^)]+)\))?(?<scopeBreaking>!)?: (?<description>.+)$/;
const releaseHeadingPattern = /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/;
const sectionHeadingPattern = /^### .+$/;

const parseArgs = (args) => {
  const options = {
    check: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--package') {
      options.packageName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--changelog') {
      options.changelog = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--check') {
      options.check = true;
      continue;
    }
  }

  return options;
};

const trimTrailingBlankLines = (lines) => {
  const trimmed = [...lines];

  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }

  return trimmed;
};

const trimBlankLines = (lines) => {
  const trimmed = trimTrailingBlankLines(lines);

  while (trimmed.length > 0 && trimmed[0] === '') {
    trimmed.shift();
  }

  return trimmed;
};

const splitChangelog = (content) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const preamble = [];
  const releases = [];
  let currentRelease;

  for (const line of lines) {
    if (releaseHeadingPattern.test(line)) {
      currentRelease = [line];
      releases.push(currentRelease);
      continue;
    }

    if (currentRelease === undefined) {
      preamble.push(line);
      continue;
    }

    currentRelease.push(line);
  }

  return { preamble, releases };
};

const parseConventionalBullet = (line) => {
  const match = line.match(conventionalBulletPattern);

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

const shouldKeepLine = ({ line, packageName }) => {
  const parsed = parseConventionalBullet(line);

  if (parsed === undefined) {
    return true;
  }

  return parsed.scope === packageName;
};

const sanitizeSection = ({ sectionLines, packageName }) => {
  const [heading, ...bodyLines] = sectionLines;
  const keptBodyLines = [];
  const removedLines = [];

  for (const line of bodyLines) {
    if (shouldKeepLine({ line, packageName })) {
      keptBodyLines.push(line);
      continue;
    }

    removedLines.push(line);
  }

  const bodyLinesToKeep = trimBlankLines(keptBodyLines);
  const meaningfulBodyLines = bodyLinesToKeep.filter((line) => line.trim().length > 0);

  if (meaningfulBodyLines.length === 0) {
    return { lines: [], removedLines };
  }

  return {
    lines: [heading, '', ...bodyLinesToKeep],
    removedLines,
  };
};

const sanitizeRelease = ({ releaseLines, packageName }) => {
  const [heading, ...bodyLines] = releaseLines;
  const sections = [];
  let currentSection;
  const releaseIntro = [];

  for (const line of bodyLines) {
    if (sectionHeadingPattern.test(line)) {
      currentSection = [line];
      sections.push(currentSection);
      continue;
    }

    if (currentSection === undefined) {
      releaseIntro.push(line);
      continue;
    }

    currentSection.push(line);
  }

  const removedLines = [];
  const keptSections = [];

  for (const sectionLines of sections) {
    const section = sanitizeSection({ sectionLines, packageName });
    removedLines.push(...section.removedLines);

    if (section.lines.length > 0) {
      keptSections.push(section.lines);
    }
  }

  if (keptSections.length === 0) {
    return { lines: [], removedLines };
  }

  const lines = [heading];
  const intro = trimTrailingBlankLines(releaseIntro);

  if (intro.some((line) => line.trim().length > 0)) {
    lines.push(...intro);
  }

  for (const section of keptSections) {
    lines.push('', ...section);
  }

  return { lines: trimTrailingBlankLines(lines), removedLines };
};

export const sanitizeFerrflowChangelog = ({ content, packageName }) => {
  const { preamble, releases } = splitChangelog(content);
  const removedLines = [];
  const sanitizedReleases = [];

  for (const releaseLines of releases) {
    const release = sanitizeRelease({ releaseLines, packageName });
    removedLines.push(...release.removedLines);

    if (release.lines.length > 0) {
      sanitizedReleases.push(release.lines);
    }
  }

  const outputLines = trimTrailingBlankLines(preamble);

  for (const releaseLines of sanitizedReleases) {
    outputLines.push('', ...releaseLines);
  }

  return {
    content: `${trimTrailingBlankLines(outputLines).join('\n')}\n`,
    removedLines,
  };
};

const resolveHookOptions = (options) => {
  const packageName = options.packageName ?? process.env.FERRFLOW_PACKAGE;
  const packagePath = process.env.FERRFLOW_PACKAGE_PATH;
  const changelog =
    options.changelog ??
    (packagePath === undefined ? undefined : path.join(packagePath, 'CHANGELOG.md'));

  if (packageName === undefined || changelog === undefined) {
    throw new Error(
      'Expected --package and --changelog, or FERRFLOW_PACKAGE and FERRFLOW_PACKAGE_PATH.',
    );
  }

  return { packageName, changelog };
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const { packageName, changelog } = resolveHookOptions(options);
  const originalContent = readFileSync(changelog, 'utf8');
  const sanitized = sanitizeFerrflowChangelog({
    content: originalContent,
    packageName,
  });

  if (sanitized.content !== originalContent) {
    console.log(
      `Removed ${sanitized.removedLines.length} out-of-scope release note(s) from ${changelog}.`,
    );

    if (options.check) {
      process.exitCode = 1;
      return;
    }

    writeFileSync(changelog, sanitized.content);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
