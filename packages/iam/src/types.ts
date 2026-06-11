import type { CdkOverrides, EnvironmentAwareProps } from '@cdk-construct/core';
import type { IManagedPolicy, PolicyStatement, Role, RoleProps } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

import type { IamPolicyValidationOptions } from './policy-validation.js';

export type IrsaRoleOverrides = Omit<RoleProps, 'assumedBy' | 'inlinePolicies' | 'managedPolicies'>;

export type IrsaRoleProps = EnvironmentAwareProps & {
  readonly serviceAccountName: string;
  readonly namespace: string;
  readonly oidcProviderUrl: string;
  readonly roleName?: string;
  readonly policyStatements?: PolicyStatement[];
  readonly managedPolicies?: IManagedPolicy[];
  readonly policyValidation?: IamPolicyValidationOptions;
  readonly roleOverrides?: CdkOverrides<IrsaRoleOverrides>;
};

export type IrsaRoleResources = {
  readonly role: Role;
};

export type IrsaRoleResourceProps = {
  readonly scope: Construct;
  readonly id: string;
  readonly props: IrsaRoleProps;
};
