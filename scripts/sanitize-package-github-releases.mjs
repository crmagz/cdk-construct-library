#!/usr/bin/env node
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sanitizeGithubReleaseBody } from './sanitize-ferrflow-github-release.mjs';

const parseArgs = (args) => {
  const options = {
    check: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      options.repo = args[index + 1];
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

const readJson = (relativePath) => JSON.parse(readFileSync(relativePath, 'utf8'));

export const packageNamesFromFerrflow = (ferrflowConfig) =>
  new Set(ferrflowConfig.package.map((workspacePackage) => workspacePackage.name));

export const packageNameFromReleaseTag = ({ tagName, packageNames }) => {
  const match = tagName.match(/^(?<packageName>.+)\/v\d+\.\d+\.\d+(?:-.+)?$/);

  if (!match?.groups) {
    return undefined;
  }

  const packageName = match.groups.packageName;

  return packageNames.has(packageName) ? packageName : undefined;
};

export const githubApiRequestOptions = ({ method, repo, path, token }) => ({
  hostname: 'api.github.com',
  method,
  path: `/repos/${repo}${path}`,
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'cdk-construct-library-release-sanitizer',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

const requestJson = ({ method, repo, path, token, body }) => {
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const requestOptions = githubApiRequestOptions({
    method,
    repo,
    path,
    token,
  });

  if (requestBody !== undefined) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.headers['Content-Length'] = Buffer.byteLength(requestBody);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (response) => {
      const chunks = [];

      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        const parsedBody = responseBody.length === 0 ? undefined : JSON.parse(responseBody);

        if (
          response.statusCode === undefined ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          reject(
            new Error(
              `GitHub API ${method} ${path} failed with ${response.statusCode}: ${responseBody}`,
            ),
          );
          return;
        }

        resolve(parsedBody);
      });
    });

    request.on('error', reject);

    if (requestBody !== undefined) {
      request.write(requestBody);
    }

    request.end();
  });
};

export const sanitizeReleaseBodies = ({ releases, packageNames }) => {
  const updates = [];

  for (const release of releases) {
    const packageName = packageNameFromReleaseTag({
      tagName: release.tag_name,
      packageNames,
    });

    if (packageName === undefined) {
      continue;
    }

    const originalBody = release.body ?? '';
    const sanitized = sanitizeGithubReleaseBody({
      body: originalBody,
      packageName,
    });

    if (sanitized.content === originalBody) {
      continue;
    }

    updates.push({
      releaseId: release.id,
      tagName: release.tag_name,
      packageName,
      body: sanitized.content,
      removedLines: sanitized.removedLines,
    });
  }

  return updates;
};

const resolveOptions = (options, env = process.env) => {
  const repo = options.repo ?? env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;

  if (repo === undefined) {
    throw new Error('Expected --repo or GITHUB_REPOSITORY.');
  }

  if (token === undefined) {
    throw new Error('Expected GITHUB_TOKEN or GH_TOKEN to update GitHub release bodies.');
  }

  return {
    repo,
    token,
    check: options.check,
  };
};

const main = async () => {
  const options = resolveOptions(parseArgs(process.argv.slice(2)));
  const packageNames = packageNamesFromFerrflow(readJson('ferrflow.json'));
  const releases = await requestJson({
    method: 'GET',
    repo: options.repo,
    path: '/releases?per_page=100',
    token: options.token,
  });
  const updates = sanitizeReleaseBodies({
    releases,
    packageNames,
  });

  if (updates.length === 0) {
    console.log('Package GitHub release bodies are already package-scoped.');
    return;
  }

  for (const update of updates) {
    console.log(
      `Removed ${update.removedLines.length} out-of-scope release note(s) from ${update.tagName}.`,
    );

    if (options.check) {
      continue;
    }

    await requestJson({
      method: 'PATCH',
      repo: options.repo,
      path: `/releases/${update.releaseId}`,
      token: options.token,
      body: {
        body: update.body,
      },
    });
  }

  if (options.check) {
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
