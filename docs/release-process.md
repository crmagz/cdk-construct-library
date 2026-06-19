# Release Process

Releases are package-scoped and inferred from Conventional Commits by FerrFlow.

## Change Story

Use the package name as the conventional commit scope:

```text
feat(s3): add bucket construct
fix(core): preserve construct metadata
perf(aurora): reduce generated policy size
feat(cloudfront): add distribution construct
feat(waf): add web acl construct
```

Write commit subjects as the decision made, not a file list. Keep them short
enough to read cleanly in generated release notes.

Releasable commit types must target a configured package scope and touch that
package path:

```text
feat(s3): add bucket construct
fix(cloudfront): preserve response header overrides
perf(core): reduce environment config allocations
```

Repo-only changes should use non-releasable types so package changelogs do not
pick up unrelated release, CI, build, or documentation work:

```text
ci(release): build core before package publish
build(projen): centralize cdk dependency versions
docs(release): explain package baseline tags
chore(repo): ignore local agent instruction files
```

`npm run release:check` validates PR commits against the configured workspace
packages. A `feat`, `fix`, `perf`, `refactor`, or breaking-change commit must
use a package scope such as `s3` and touch `packages/s3/`. It may touch
repo-level generated files in the same commit, but it must not touch another
package directory. CI runs the same guard, and Lefthook runs it before push so
bad package-scoped release commits are caught before they leave the workstation.

FerrFlow also runs a package changelog sanitizer before each generated release
commit. The sanitizer keeps release-note entries whose conventional commit scope
matches the package being released and removes entries from other packages or
repo-only release maintenance.

## Semver Rules

FerrFlow evaluates package changes without missed-release recovery. The release
range is intentionally bounded to the current merge so a package release does
not gather older semver-relevant commits from unrelated packages.

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
core/v<semver>
aurora/v<semver>
s3/v<semver>
sqs/v<semver>
iam/v<semver>
cloudfront/v<semver>
waf/v<semver>
```

Before merging a package PR for a package that has never been released, create a
package-specific baseline tag on current `main`:

```sh
git fetch origin main --tags
git tag <service>/v0.0.0 origin/main
git push origin <service>/v0.0.0
```

The baseline tag gives FerrFlow a clean lower bound for the first real package
release. Without it, the first release for a new package can collect older
semver-relevant commits from repository history.

## Publish

Merging a releasable PR to `main` runs `.github/workflows/release.yml`. The
workflow runs `FerrLabs/FerrFlow`, which calculates package versions, updates
package metadata and changelogs, creates the release commit, creates service
tags, creates GitHub releases, and runs each package's publish hook.

The publish hooks build the changed workspaces and publish them with npm trusted
publishing and provenance from the `release.yml` workflow.

FerrFlow writes one release commit per package so package bumps can be audited
and reverted independently.

Each package must already exist in npm and have trusted publishing configured
for this repository and the `release.yml` workflow before CI can publish it.
