# Release Process

Releases are package-scoped and managed with Changesets.

## Change Story

Feature and fix PRs should include a changeset when they change a published
package:

```sh
npm run changeset
```

Select one package for a service-only release, such as `@cdk-construct/s3`.
Select multiple packages when the change intentionally moves shared APIs and
service packages together.

Use concise summaries that describe the decision made:

```text
Add environment metadata helpers
Preserve construct ids in output helpers
Document package usage
```

## Release PR

Merging a PR with changesets to `main` runs `.github/workflows/release.yml`.
The workflow opens or updates a release PR that contains version bumps and
package changelogs.

Review the generated release PR for the intended package set before merging it.
The release PR can update one package, several packages, or every workspace
package depending on the included changesets.

## Publish

Merging the release PR back to `main` runs the same `release.yml` workflow and
publishes changed packages with npm trusted publishing and provenance.

Each package must already exist in npm and have trusted publishing configured
for this repository and the `release.yml` workflow before CI can publish it.
