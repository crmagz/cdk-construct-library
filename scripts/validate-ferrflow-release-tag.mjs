#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

    if (arg === '--tag') {
      options.tag = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--existing-tags-file') {
      options.existingTagsFile = args[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
};

const tagsFromGit = () => {
  const output = execFileSync('git', ['tag', '--list'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  return output.length === 0 ? [] : output.split('\n');
};

const tagsFromFile = (file) => {
  const content = readFileSync(file, 'utf8').trim();

  return content.length === 0 ? [] : content.split('\n');
};

export const releaseTagName = ({ packageName, version, tag }) =>
  tag ?? `${packageName}/v${version}`;

export const releaseTagExists = ({ tagName, existingTags }) => existingTags.includes(tagName);

export const validateReleaseTagDoesNotExist = ({ tagName, existingTags }) =>
  releaseTagExists({ tagName, existingTags })
    ? [`Refusing to release ${tagName} because the tag already exists.`]
    : [];

const resolveOptions = (options, env = process.env) => {
  const packageName = options.packageName ?? env.FERRFLOW_PACKAGE;
  const version = options.version ?? env.FERRFLOW_NEW_VERSION;
  const tag = options.tag ?? env.FERRFLOW_TAG;
  const existingTagsFile = options.existingTagsFile ?? env.EXISTING_RELEASE_TAGS_FILE;

  if (packageName === undefined || version === undefined) {
    throw new Error(
      'Expected --package and --version, or FERRFLOW_PACKAGE and FERRFLOW_NEW_VERSION.',
    );
  }

  return {
    tagName: releaseTagName({ packageName, version, tag }),
    existingTags: existingTagsFile === undefined ? tagsFromGit() : tagsFromFile(existingTagsFile),
  };
};

const main = () => {
  const options = resolveOptions(parseArgs(process.argv.slice(2)));
  const errors = validateReleaseTagDoesNotExist(options);

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
