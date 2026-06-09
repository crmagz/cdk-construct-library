# @cdk-construct/sqs

Environment-aware SQS queue constructs for AWS CDK.

## Overview

`SqsQueue` creates a primary queue and dead-letter queue pair with secure, production-leaning defaults and explicit environment configuration. Defaults can be overridden through typed props, with `queueOverrides` and `deadLetterQueueOverrides` available when a workload needs direct CDK `QueueProps`.

See [docs/queue.md](./docs/queue.md) for environment configuration and stack usage examples.
