# Release Process

Releases are managed with Changesets.

## Change Intent

Package changes should include a `.changeset/*.md` file that names the package,
the semver bump, and a package-scoped Conventional Commit release-note summary:

```md
---
'@cdk-construct/s3': minor
---

feat(s3): add bucket lifecycle defaults for non-production environments
```

One pull request can include one changeset for one package, multiple changesets
for separate packages, or one changeset that intentionally bumps several
packages together.

Conventional Commit titles are still required for PR readability. Package
versions come from Changesets, while package changelogs and GitHub release notes
are rendered into Conventional Commit categories such as `Breaking Changes`,
`Features`, `Bug Fixes`, and `Performance`.

Changeset summaries should start with the same Conventional Commit shape used by
commit titles:

```text
feat(s3): add bucket lifecycle defaults
fix(sqs): enforce dead-letter queue defaults
perf(cloudfront): reduce distribution policy duplication
feat(api-gateway)!: replace endpoint defaults
```

Changesets still uses `major`, `minor`, and `patch` internally to calculate the
next version. Those terms should not appear as release-note sections after the
version PR runs.

## Semver Rules

Use the smallest accurate bump:

```text
patch: compatible bug fix or internal behavior correction
minor: new construct, option, or backwards-compatible behavior
major: breaking public API or changed default behavior requiring migration
```

Repo-only CI, docs, generated config, and tooling changes do not need a
changeset unless they affect a published package.

## CI Flow

Pull requests run `changeset status --since <base>` so package changes can be
reviewed with their release intent.

After a PR with changesets merges to `main`, `.github/workflows/release.yml`
runs `changesets/action`. When pending changesets exist, the action opens or
updates a version PR named:

```text
chore(release): version packages
```

That version PR contains the package version bumps, changelog updates, and
removal of consumed `.changeset/*.md` files. Review that PR to validate the
release notes before publishing.

When the version PR merges to `main`, the same workflow publishes changed
packages with:

```sh
npm run release:publish
```

`release:publish` builds the repo and runs `changeset publish`.

## Publishing

Publishing uses npm trusted publishing and provenance from the `release.yml`
workflow. Each package must already exist in npm and must trust this repository
and workflow filename before CI can publish it.

Changesets creates package releases from the package name and version. If this
project later requires service-style GitHub tags such as `s3/v1.2.3`, add that
as a dedicated post-publish step after the Changesets release flow is stable.
