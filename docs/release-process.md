# Release Process

Releases are package-scoped and inferred from Conventional Commits by FerrFlow.

## Change Story

Use the package name as the conventional commit scope:

```text
feat(s3): add bucket construct
fix(core): preserve construct metadata
perf(aurora): reduce generated policy size
```

Write commit subjects as the decision made, not a file list. Keep them short
enough to read cleanly in generated release notes.

## Semver Rules

FerrFlow evaluates commits that touched each `packages/<service>` directory
since that service's latest tag. `recoverMissedReleases` is enabled so a package
that changed before the workflow was added can still be released later.

```text
feat: minor
fix: patch
perf: patch
!: major
BREAKING CHANGE: major
```

Other commit types do not publish a package by themselves.

## Tags

Package releases use service-prefixed semver tags:

```text
core/v0.1.0
aurora/v0.1.0
s3/v0.1.0
sqs/v0.1.0
iam/v0.1.0
cloudwatch/v0.1.0
```

## Publish

Merging a releasable PR to `main` runs `.github/workflows/release.yml`. The
workflow runs `FerrLabs/FerrFlow`, which calculates package versions, updates
package metadata and changelogs, creates the release commit, creates service
tags, creates GitHub releases, and runs each package's publish hook.

The publish hooks build the changed workspaces and publish them with npm trusted
publishing and provenance from the `release.yml` workflow.

Each package must already exist in npm and have trusted publishing configured
for this repository and the `release.yml` workflow before CI can publish it.
