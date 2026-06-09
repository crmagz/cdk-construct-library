# Release Process

Releases are package-scoped and generated from conventional commits.

## Commit Story

Use the package name as the conventional commit scope:

```text
feat(core): add environment metadata helpers
fix(core): preserve construct ids in output helpers
docs(core): document package usage
```

Write commit subjects as the decision made, not a file list. Keep them short
enough to read cleanly in generated release notes.

## Tags

Package releases use service-prefixed semver tags:

```text
core/v0.1.0
aurora/v0.1.0
```

The first workspace release publishes `@cdk-construct/core` and creates a
`core/v...` tag.
