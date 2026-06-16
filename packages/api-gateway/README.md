# @cdk-construct/api-gateway

Environment-aware API Gateway REST API constructs for AWS CDK.

## Overview

`ApiGatewayRestApi` creates a regional REST API with CloudWatch access logs, X-Ray tracing, execution metrics, and environment-aware log retention defaults. Direct CDK overrides are available for the REST API, deployment stage, and access log group when a workload needs service-specific control.

See [docs/rest-api.md](./docs/rest-api.md) for configuration and stack usage examples.
