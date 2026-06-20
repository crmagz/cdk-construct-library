#!/usr/bin/env node
import https from 'node:https';
import { fileURLToPath } from 'node:url';

import { sanitizeFerrflowChangelog } from './sanitize-ferrflow-changelog.mjs';

const releaseHeadingPattern = /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/m;

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

    if (arg === '--repo') {
      options.repo = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--tag') {
      options.tag = args[index + 1];
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

export const sanitizeGithubReleaseBody = ({ body, packageName }) =>
  withEmptyReleaseMessage({
    originalBody: body,
    sanitized: sanitizeFerrflowChangelog({
      content: body,
      packageName,
    }),
  });

const withEmptyReleaseMessage = ({ originalBody, sanitized }) => {
  if (sanitized.content.trim().length > 0 || sanitized.removedLines.length === 0) {
    return sanitized;
  }

  const heading = originalBody.match(releaseHeadingPattern)?.[0];

  if (heading === undefined) {
    return sanitized;
  }

  return {
    ...sanitized,
    content: `\n${heading}\n\nNo package-scoped changes.\n`,
  };
};

export const resolveGithubReleaseOptions = (options, env = process.env) => {
  const packageName = options.packageName ?? env.FERRFLOW_PACKAGE;
  const tag = options.tag ?? env.FERRFLOW_TAG;
  const repo = options.repo ?? env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;

  if (packageName === undefined || tag === undefined || repo === undefined) {
    throw new Error(
      'Expected --package, --tag, and --repo, or FERRFLOW_PACKAGE, FERRFLOW_TAG, and GITHUB_REPOSITORY.',
    );
  }

  if (token === undefined) {
    throw new Error('Expected GITHUB_TOKEN or GH_TOKEN to update the GitHub release body.');
  }

  return {
    packageName,
    tag,
    repo,
    token,
  };
};

export const githubApiRequestOptions = ({ method, repo, path, token }) => {
  return {
    hostname: 'api.github.com',
    method,
    path: `/repos/${repo}${path}`,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'cdk-construct-library-release-sanitizer',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
};

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

export const releaseByTagPath = (tag) => `/releases/tags/${encodeURIComponent(tag)}`;

export const releasePatchPath = (releaseId) => `/releases/${releaseId}`;

const sanitizeGithubRelease = async (options) => {
  const release = await requestJson({
    method: 'GET',
    repo: options.repo,
    path: releaseByTagPath(options.tag),
    token: options.token,
  });
  const originalBody = release.body ?? '';
  const sanitized = sanitizeGithubReleaseBody({
    body: originalBody,
    packageName: options.packageName,
  });

  if (sanitized.content === originalBody) {
    return { changed: false, removedLines: [] };
  }

  console.log(
    `Removed ${sanitized.removedLines.length} out-of-scope release note(s) from ${options.tag}.`,
  );

  if (options.check) {
    process.exitCode = 1;
    return { changed: true, removedLines: sanitized.removedLines };
  }

  await requestJson({
    method: 'PATCH',
    repo: options.repo,
    path: releasePatchPath(release.id),
    token: options.token,
    body: {
      body: sanitized.content,
    },
  });

  return { changed: true, removedLines: sanitized.removedLines };
};

const main = async () => {
  const options = resolveGithubReleaseOptions(parseArgs(process.argv.slice(2)));

  await sanitizeGithubRelease(options);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
