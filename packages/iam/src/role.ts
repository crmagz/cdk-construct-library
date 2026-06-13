import { resolveEnvironmentConfig } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { FederatedPrincipal, Role } from 'aws-cdk-lib/aws-iam';
import type { IPrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { assertLeastPrivilegePolicyStatements } from './policy-validation.js';
import type { IrsaRoleProps, IrsaRoleResourceProps, IrsaRoleResources } from './types.js';

const normalizeOidcProviderUrl = (oidcProviderUrl: string): string => {
  const trimmedOidcProviderUrl = oidcProviderUrl.trim();

  if (/^http:\/\//i.test(trimmedOidcProviderUrl)) {
    throw new Error('IrsaRole oidcProviderUrl must not use http://.');
  }

  const normalizedOidcProviderUrl = trimmedOidcProviderUrl
    .replace(/^https:\/\//i, '')
    .replace(/\/+$/, '');

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedOidcProviderUrl)) {
    throw new Error('IrsaRole oidcProviderUrl must use https:// or omit the scheme.');
  }

  if (!normalizedOidcProviderUrl) {
    throw new Error('IrsaRole oidcProviderUrl is required.');
  }

  return normalizedOidcProviderUrl;
};

const createOidcProviderArn = (scope: Construct, props: IrsaRoleProps): string => {
  const environment = resolveEnvironmentConfig(props);
  const oidcProviderUrl = normalizeOidcProviderUrl(props.oidcProviderUrl);

  if (!environment.account) {
    throw new Error('IrsaRole requires props.env.account to build the OIDC provider ARN.');
  }

  return `arn:${Stack.of(scope).partition}:iam::${environment.account}:oidc-provider/${oidcProviderUrl}`;
};

const createServiceAccountSubject = (props: IrsaRoleProps): string => {
  return `system:serviceaccount:${props.namespace}:${props.serviceAccountName}`;
};

const createIrsaAssumeRolePrincipal = (scope: Construct, props: IrsaRoleProps): IPrincipal => {
  const oidcProviderUrl = normalizeOidcProviderUrl(props.oidcProviderUrl);

  return new FederatedPrincipal(
    createOidcProviderArn(scope, props),
    {
      StringEquals: {
        [`${oidcProviderUrl}:aud`]: 'sts.amazonaws.com',
        [`${oidcProviderUrl}:sub`]: createServiceAccountSubject(props),
      },
    },
    'sts:AssumeRoleWithWebIdentity',
  );
};

const resolveRoleName = (props: IrsaRoleProps): string => {
  const environment = resolveEnvironmentConfig(props);

  return props.roleName ?? `${props.serviceAccountName}-${environment.name}`;
};

const assertTrustedPrincipalOverridesAreNotUsed = (props: IrsaRoleProps): void => {
  const roleOverrides = props.roleOverrides as Record<string, unknown> | undefined;

  if (!roleOverrides) {
    return;
  }

  if ('assumedBy' in roleOverrides) {
    throw new Error('IrsaRole does not allow roleOverrides.assumedBy.');
  }

  if ('inlinePolicies' in roleOverrides) {
    throw new Error('IrsaRole does not allow roleOverrides.inlinePolicies; use policyStatements.');
  }
};

export class IrsaRole extends Construct {
  public readonly role: Role;

  public constructor(scope: Construct, id: string, props: IrsaRoleProps) {
    super(scope, id);

    const resources = createIrsaRoleResource({
      scope: this,
      id: 'Resource',
      props,
    });

    this.role = resources.role;
  }
}

export const createIrsaRoleResource = (resourceProps: IrsaRoleResourceProps): IrsaRoleResources => {
  const { scope, id, props } = resourceProps;
  const policyStatements = props.policyStatements ?? [];

  assertTrustedPrincipalOverridesAreNotUsed(props);
  assertLeastPrivilegePolicyStatements(policyStatements, props.policyValidation);

  const role = new Role(scope, `${id}Role`, {
    assumedBy: createIrsaAssumeRolePrincipal(scope, props),
    roleName: resolveRoleName(props),
    managedPolicies: props.managedPolicies,
    ...props.roleOverrides,
  });

  policyStatements.forEach((policyStatement) => {
    role.addToPolicy(policyStatement);
  });

  return { role };
};

export const createIrsaRole = (
  scope: Construct,
  id: string,
  props: IrsaRoleProps,
): IrsaRoleResources => {
  const irsaRole = new IrsaRole(scope, id, props);

  return {
    role: irsaRole.role,
  };
};
