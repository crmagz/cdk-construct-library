# NPM Publishing

Packages are published under the public `@cdk-construct` npm scope.

## First Publish

New scoped packages must exist on npm before CI trusted publishing can own the
normal release path. If a package does not exist yet, bootstrap it from a local
npm session that is authorized for the `cdk-construct` npm org.

Check the local npm identity:

```sh
npm whoami
npm org ls cdk-construct
```

The user returned by `npm whoami` must have permission to create packages in the
`cdk-construct` org. If not, log in with the correct npm account:

```sh
npm logout
npm login
```

Publish the package publicly:

```sh
npm publish --workspace @cdk-construct/core --access public
```

Use the matching workspace package name for future packages, for example:

```sh
npm publish --workspace @cdk-construct/aurora --access public
```

## Trusted Publishing

After the package exists, configure trusted publishing in npm for the exact
package and workflow.

Expected settings:

```text
Package: @cdk-construct/<package>
Provider: GitHub Actions
Owner: crmagz
Repository: cdk-construct-library
Workflow filename: release.yml
Allowed action: npm publish
```

The GitHub workflow must request OIDC:

```yaml
permissions:
  id-token: write
  contents: read
```

## Common Failures

`ENEEDAUTH` in CI means npm did not exchange the GitHub OIDC identity for publish
credentials. Check the package trusted-publisher settings, workflow filename,
repository owner/name, and package existence.

`E404` during first publish usually means the package does not exist or the npm
user does not have permission to create packages under `@cdk-construct`.

`npm auto-corrected repository.url` means package metadata should use a
`git+https://...` repository URL.
