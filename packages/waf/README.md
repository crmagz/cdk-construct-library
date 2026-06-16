# @cdk-construct/waf

Environment-aware AWS WAF web ACL constructs for AWS CDK.

## Overview

`WafWebAcl` creates an AWS WAFv2 web ACL with CloudWatch visibility enabled,
sampled requests enabled, environment-aware naming, and secure AWS managed-rule
defaults. Managed rule groups can be replaced or tuned explicitly, and
`webAclOverrides` is available when a workload needs direct `CfnWebACLProps`.

See [docs/web-acl.md](./docs/web-acl.md) for environment configuration,
managed-rule customization, and stack usage examples.
