import { EnvironmentName } from '@cdk-construct/core';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  AccountRootPrincipal,
  AnyPrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';

import { IrsaRole, createIrsaRole, createIrsaRoleResource } from '../src/index.js';
import type { IrsaRoleProps } from '../src/index.js';

const prodEnv = {
  name: EnvironmentName.PROD,
  account: '123456789012',
  region: 'us-east-1',
};

const defaultProps = (props: Partial<IrsaRoleProps> = {}): IrsaRoleProps => {
  return {
    env: prodEnv,
    namespace: 'orders',
    serviceAccountName: 'orders-api',
    oidcProviderUrl: 'oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
    policyStatements: [
      new PolicyStatement({
        sid: 'SendOrdersMessages',
        effect: Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: ['arn:aws:sqs:us-east-1:123456789012:orders'],
      }),
    ],
    ...props,
  };
};

const synthesizeRole = (role: IrsaRole): Template => {
  return Template.fromStack(Stack.of(role));
};

describe('IrsaRole', () => {
  it('creates an IRSA role with a scoped OIDC trust policy', () => {
    const stack = new Stack();
    const role = new IrsaRole(stack, 'OrdersRole', defaultProps());

    const template = synthesizeRole(role);
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'orders-api-prod',
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Principal: {
              Federated: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
                  ],
                ],
              },
            },
            Condition: {
              StringEquals: {
                'oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE:aud': 'sts.amazonaws.com',
                'oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE:sub':
                  'system:serviceaccount:orders:orders-api',
              },
            },
          }),
        ],
      },
    });
  });

  it('normalizes https OIDC provider URLs', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'NormalizedOrdersRole',
      defaultProps({
        oidcProviderUrl: ' https://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE/// ',
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Principal: {
              Federated: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
                  ],
                ],
              },
            },
          }),
        ],
      },
    });
  });

  it('normalizes namespace and service account names in the trust policy', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'NormalizedSubjectRole',
      defaultProps({
        namespace: ' orders ',
        serviceAccountName: ' orders-api ',
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'orders-api-prod',
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: {
                'oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE:sub':
                  'system:serviceaccount:orders:orders-api',
              },
            },
          }),
        ],
      },
    });
  });

  it('rejects empty namespace values', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'EmptyNamespaceRole',
        defaultProps({
          namespace: ' ',
        }),
      );
    }).toThrow(/namespace is required/);
  });

  it('rejects empty service account names', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'EmptyServiceAccountRole',
        defaultProps({
          serviceAccountName: ' ',
        }),
      );
    }).toThrow(/serviceAccountName is required/);
  });

  it('rejects OIDC provider URLs with http scheme', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'HttpOidcRole',
        defaultProps({
          oidcProviderUrl: ' http://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE ',
        }),
      );
    }).toThrow(/oidcProviderUrl must not use http/);
  });

  it('rejects unsupported OIDC provider URL schemes', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'UnsupportedSchemeOidcRole',
        defaultProps({
          oidcProviderUrl: 'ftp://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
        }),
      );
    }).toThrow(/https:\/\/ or omit the scheme/);
  });

  it('rejects OIDC provider URLs that normalize to a leading slash', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'LeadingSlashOidcRole',
        defaultProps({
          oidcProviderUrl: ' /oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE ',
        }),
      );
    }).toThrow(/must not start with a slash/);
  });

  it('rejects OIDC provider URLs with whitespace after normalization', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'WhitespaceOidcRole',
        defaultProps({
          oidcProviderUrl: 'https:// oidc.eks.us-east-1.amazonaws.com/id/EXAMPLE',
        }),
      );
    }).toThrow(/must not contain whitespace/);
  });

  it('requires an account in the environment config', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'MissingAccountRole',
        defaultProps({
          env: {
            name: EnvironmentName.PROD,
            region: 'us-east-1',
          },
        }),
      );
    }).toThrow(/props\.env\.account/);
  });

  it('attaches inline policy statements to the role', () => {
    const stack = new Stack();
    const role = new IrsaRole(stack, 'PolicyRole', defaultProps());

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Sid: 'SendOrdersMessages',
            Action: 'sqs:SendMessage',
            Effect: 'Allow',
            Resource: 'arn:aws:sqs:us-east-1:123456789012:orders',
          },
        ],
      },
    });
  });

  it('supports custom role names and managed policies', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'ConfiguredRole',
      defaultProps({
        roleName: 'orders-irsa',
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'orders-irsa',
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
            ],
          ],
        },
      ],
    });
  });

  it('allows direct CDK role overrides', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'OverrideRole',
      defaultProps({
        roleOverrides: {
          description: 'IRSA role for the orders workload',
        },
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Role', {
      Description: 'IRSA role for the orders workload',
    });
  });

  it('uses the dedicated role name over unsafe role override names', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'RoleNameOverrideRole',
      defaultProps({
        roleName: 'orders-irsa',
        roleOverrides: {
          roleName: 'unsafe-override',
        } as unknown as IrsaRoleProps['roleOverrides'],
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'orders-irsa',
    });
  });

  it('rejects wildcard policy actions by default', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'WildcardActionRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'WildcardAction',
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: ['arn:aws:s3:::orders/*'],
            }),
          ],
        }),
      );
    }).toThrow(/WILDCARD_ACTION/);
  });

  it('rejects wildcard policy resources by default', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'WildcardResourceRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'CreateLogGroup',
              effect: Effect.ALLOW,
              actions: ['logs:CreateLogGroup'],
              resources: ['*'],
            }),
          ],
        }),
      );
    }).toThrow(/WILDCARD_RESOURCE/);
  });

  it('allows wildcard policy resources with an explicit reason', () => {
    const stack = new Stack();
    const role = new IrsaRole(
      stack,
      'AllowedWildcardResourceRole',
      defaultProps({
        policyStatements: [
          new PolicyStatement({
            sid: 'CreateLogGroup',
            effect: Effect.ALLOW,
            actions: ['logs:CreateLogGroup'],
            resources: ['*'],
          }),
        ],
        policyValidation: {
          allowWildcardResources: [
            {
              value: '*',
              reason: 'CloudWatch Logs CreateLogGroup requires wildcard resources.',
            },
          ],
        },
      }),
    );

    const template = synthesizeRole(role);
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Sid: 'CreateLogGroup',
            Action: 'logs:CreateLogGroup',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
    });
  });

  it('rejects role trust overrides', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'TrustOverrideRole',
        defaultProps({
          roleOverrides: {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
          } as unknown as IrsaRoleProps['roleOverrides'],
        }),
      );
    }).toThrow(/roleOverrides\.assumedBy/);
  });

  it('rejects undefined role trust override keys from unsafe casts', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'UndefinedTrustOverrideRole',
        defaultProps({
          roleOverrides: {
            assumedBy: undefined,
          } as unknown as IrsaRoleProps['roleOverrides'],
        }),
      );
    }).toThrow(/roleOverrides\.assumedBy/);
  });
});

describe('createIrsaRole', () => {
  it('returns the role resource', () => {
    const stack = new Stack();
    const resources = createIrsaRole(stack, 'Orders', defaultProps());

    expect(resources.role).toBeInstanceOf(Role);
  });
});

describe('policy validation utilities', () => {
  it('rejects policy statements without Sids', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'MissingSidRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: ['arn:aws:sqs:us-east-1:123456789012:orders'],
            }),
          ],
        }),
      );
    }).toThrow(/MISSING_SID/);
  });

  it('rejects duplicate policy statement Sids', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'DuplicateSidRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'SendOrdersMessages',
              effect: Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: ['arn:aws:sqs:us-east-1:123456789012:orders'],
            }),
            new PolicyStatement({
              sid: 'SendOrdersMessages',
              effect: Effect.ALLOW,
              actions: ['sqs:GetQueueAttributes'],
              resources: ['arn:aws:sqs:us-east-1:123456789012:orders'],
            }),
          ],
        }),
      );
    }).toThrow(/DUPLICATE_SID statement 2.*first used by statement 1/);
  });

  it('rejects NotAction and NotResource statements', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'NotPolicyRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'NotPolicy',
              effect: Effect.ALLOW,
              notActions: ['iam:DeleteRole'],
              notResources: ['arn:aws:iam::123456789012:role/protected'],
            }),
          ],
        }),
      );
    }).toThrow(/NOT_ACTION/);
  });

  it('rejects root principals in policy statements', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'RootPrincipalRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'RootPrincipal',
              effect: Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              principals: [new AccountRootPrincipal()],
              resources: ['arn:aws:iam::123456789012:role/orders'],
            }),
          ],
        }),
      );
    }).toThrow(/ROOT_PRINCIPAL/);
  });

  it('rejects wildcard principals in policy statements', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'WildcardPrincipalRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'WildcardPrincipal',
              effect: Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              principals: [new AnyPrincipal()],
              resources: ['arn:aws:iam::123456789012:role/orders'],
            }),
          ],
        }),
      );
    }).toThrow(/WILDCARD_PRINCIPAL/);
  });

  it('rejects any principals in identity-based role policy statements', () => {
    const stack = new Stack();

    expect(() => {
      new IrsaRole(
        stack,
        'PrincipalPolicyRole',
        defaultProps({
          policyStatements: [
            new PolicyStatement({
              sid: 'ServicePrincipal',
              effect: Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              principals: [new ServicePrincipal('lambda.amazonaws.com')],
              resources: ['arn:aws:iam::123456789012:role/orders'],
            }),
          ],
        }),
      );
    }).toThrow(/PRINCIPAL_NOT_ALLOWED/);
  });
});

describe('createIrsaRoleResource', () => {
  it('creates explicit role resources from typed resource props', () => {
    const stack = new Stack();
    const resources = createIrsaRoleResource({
      scope: stack,
      id: 'Orders',
      props: defaultProps({
        roleName: 'orders-resource-role',
      }),
    });

    expect(resources.role).toBeInstanceOf(Role);
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'orders-resource-role',
    });
  });
});
