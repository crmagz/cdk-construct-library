import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const semverHeadingPattern = /^### (Major|Minor|Patch) Changes$/;
const versionHeadingPattern = /^## /;
const commitHashLinePattern = /^-\s+(?<commit>[a-f0-9]{7,40}):\s+/;
const execFileAsync = promisify(execFile);

const categoryOrder = [
  'Breaking Changes',
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Documentation',
  'Tests',
  'Build',
  'CI',
  'Reverts',
  'Maintenance',
  'Other Changes',
];

const conventionalTypePattern = /^-\s+(?<type>[a-z]+)(?:\([^)]+\))?(?<breaking>!)?:\s+/;
const packageScopedCommitPattern = /^-\s+(?<type>[a-z]+)\((?<scope>[^)]+)\)(?<breaking>!)?:\s+/;
const repoMaintenanceScopes = new Set(['build', 'npm', 'projen', 'release', 'repo']);

const categoryByType = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  revert: 'Reverts',
  chore: 'Maintenance',
  style: 'Maintenance',
};

const fallbackCategoryBySemverType = {
  Major: 'Breaking Changes',
  Minor: 'Features',
  Patch: 'Other Changes',
};

const categorizeEntry = (entry) => {
  const match = conventionalTypePattern.exec(entry.lines[0] ?? '');

  if (match?.groups?.breaking) {
    return 'Breaking Changes';
  }

  if (match?.groups?.type) {
    return categoryByType[match.groups.type] ?? 'Other Changes';
  }

  return fallbackCategoryBySemverType[entry.semverType] ?? 'Other Changes';
};

const normalizeEntry = (entry, commitSubjects) => {
  const firstLine = entry.lines[0] ?? '';
  const match = commitHashLinePattern.exec(firstLine);

  if (!match?.groups?.commit) {
    return entry;
  }

  const commitSubject = commitSubjects.get(match.groups.commit);
  const subjectMatch = packageScopedCommitPattern.exec(`- ${commitSubject}`);

  if (!commitSubject || !subjectMatch?.groups?.scope) {
    return entry;
  }

  if (repoMaintenanceScopes.has(subjectMatch.groups.scope)) {
    return entry;
  }

  return {
    ...entry,
    lines: [`- ${commitSubject}`, ...entry.lines.slice(1)],
  };
};

const splitVersionSections = (source) => {
  const lines = source.split('\n');
  const sections = [];
  let current = [];

  for (const line of lines) {
    if (versionHeadingPattern.test(line) && current.length > 0) {
      sections.push(current);
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    sections.push(current);
  }

  return sections;
};

const extractSemverEntries = (lines) => {
  const entries = [];
  const passthroughLines = [];
  let semverType;
  let currentEntry;
  let sawSemverHeading = false;

  for (const line of lines.slice(1)) {
    const headingMatch = semverHeadingPattern.exec(line);
    if (headingMatch) {
      sawSemverHeading = true;
      semverType = headingMatch[1];
      currentEntry = undefined;
      continue;
    }

    if (!semverType) {
      continue;
    }

    if (line.trim() === '') {
      if (passthroughLines.length > 0) {
        passthroughLines.push(line);
      }

      continue;
    }

    if (line.startsWith('- ')) {
      currentEntry = {
        semverType,
        lines: [line],
      };
      entries.push(currentEntry);
      continue;
    }

    if (currentEntry && line.startsWith('  ')) {
      currentEntry.lines.push(line);
      continue;
    }

    passthroughLines.push(line);
  }

  return {
    entries,
    passthroughLines,
    sawSemverHeading,
  };
};

const formatVersionSection = (lines, commitSubjects) => {
  const { entries, passthroughLines, sawSemverHeading } = extractSemverEntries(lines);

  if (!sawSemverHeading || entries.length === 0) {
    return lines.join('\n');
  }

  const entriesByCategory = new Map(categoryOrder.map((category) => [category, []]));

  for (const entry of entries.map((item) => normalizeEntry(item, commitSubjects))) {
    entriesByCategory.get(categorizeEntry(entry))?.push(entry.lines.join('\n'));
  }

  const formattedGroups = categoryOrder
    .map((category) => {
      const categoryEntries = entriesByCategory.get(category) ?? [];

      if (categoryEntries.length === 0) {
        return undefined;
      }

      return `### ${category}\n\n${categoryEntries.join('\n')}`;
    })
    .filter(Boolean);

  const passthrough = passthroughLines.join('\n').trimEnd();

  return `${[lines[0], ...formattedGroups, passthrough].filter(Boolean).join('\n\n')}\n`;
};

export const formatChangelog = (source, options = {}) => {
  const commitSubjects = options.commitSubjects ?? new Map();

  return splitVersionSections(source)
    .map((section) => formatVersionSection(section, commitSubjects))
    .join('\n');
};

const extractCommitHashes = (source) =>
  [...source.matchAll(new RegExp(commitHashLinePattern, 'gm'))]
    .map((match) => match.groups?.commit)
    .filter(Boolean);

const resolveCommitSubject = async (commit) => {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%s', commit]);
    return stdout.trim();
  } catch {
    return undefined;
  }
};

const resolveCommitSubjects = async (commits) => {
  const entries = await Promise.all(
    [...new Set(commits)].map(async (commit) => [commit, await resolveCommitSubject(commit)]),
  );

  return new Map(entries.filter((entry) => entry[1]));
};

const findChangedPackageChangelogs = async (root) => {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', '--', 'packages/*/CHANGELOG.md'],
      {
        cwd: root,
      },
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .map((relativePath) => path.join(root, relativePath));
  } catch {
    return [];
  }
};

export const formatChangelogFile = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const commitSubjects = await resolveCommitSubjects(extractCommitHashes(source));
  const formatted = formatChangelog(source, { commitSubjects });

  if (formatted !== source) {
    await writeFile(filePath, formatted, 'utf8');
  }
};

export const formatChangedPackageChangelogs = async (root = process.cwd()) => {
  const changelogPaths = await findChangedPackageChangelogs(root);

  await Promise.all(changelogPaths.map(formatChangelogFile));
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await formatChangedPackageChangelogs();
}
