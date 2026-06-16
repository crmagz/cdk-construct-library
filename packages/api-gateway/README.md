# @cdk-construct/api-gateway

Environment-aware API Gateway REST API constructs for AWS CDK.

## Overview

This package provides explicit REST API constructs for private and regional
API Gateway deployments. Both variants include CloudWatch access logs, X-Ray
tracing, execution metrics, IAM authorization defaults, request validation, and
environment-aware log retention.

Use `PrivateApiGatewayRestApi` when traffic should stay behind API Gateway VPC
endpoints. Use `RegionalApiGatewayRestApi` when the API should be reachable as a
regional API. `ApiGatewayVpcEndpoint` creates the interface endpoint and security
group foundation for private APIs.

See [docs/rest-api.md](./docs/rest-api.md) for configuration and stack usage examples.
