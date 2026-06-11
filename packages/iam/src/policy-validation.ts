import type { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export enum IamPolicyValidationFindingCode {
  DUPLICATE_SID = 'DUPLICATE_SID',
  EMPTY_STATEMENT = 'EMPTY_STATEMENT',
  MISSING_SID = 'MISSING_SID',
  NOT_ACTION = 'NOT_ACTION',
  NOT_RESOURCE = 'NOT_RESOURCE',
  WILDCARD_ACTION = 'WILDCARD_ACTION',
  WILDCARD_RESOURCE = 'WILDCARD_RESOURCE',
  WILDCARD_PRINCIPAL = 'WILDCARD_PRINCIPAL',
  ROOT_PRINCIPAL = 'ROOT_PRINCIPAL',
}

export type IamPolicyValidationFinding = {
  readonly code: IamPolicyValidationFindingCode;
  readonly message: string;
  readonly statementIndex: number;
  readonly value?: string;
};

export type IamPolicyValidationException = {
  readonly value: string;
  readonly reason: string;
};

export type IamPolicyValidationOptions = {
  readonly allowWildcardResources?: readonly IamPolicyValidationException[];
};

type PolicyStatementJson = {
  readonly Sid?: string;
  readonly Action?: string | readonly string[];
  readonly NotAction?: string | readonly string[];
  readonly Resource?: string | readonly string[];
  readonly NotResource?: string | readonly string[];
  readonly Principal?: unknown;
};

type PrincipalObject = {
  readonly constructor?: {
    readonly name?: string;
  };
  readonly dedupeString?: () => string;
};

const toArray = (value: string | readonly string[] | undefined): readonly string[] => {
  if (!value) {
    return [];
  }

  return typeof value === 'string' ? [value] : value;
};

const isAllowed = (
  value: string,
  exceptions: readonly IamPolicyValidationException[] = [],
): boolean => {
  return exceptions.some(
    (exception) => exception.value === value && exception.reason.trim() !== '',
  );
};

const hasActionWildcard = (action: string): boolean => {
  return action.includes('*') || action.includes('?');
};

const resolveStatementSid = (statement: PolicyStatement): string | undefined => {
  const statementJson = statement.toStatementJson() as PolicyStatementJson;

  return statementJson.Sid?.trim() || undefined;
};

const isWildcardResource = (resource: string): boolean => {
  return resource === '*';
};

const findPrincipalValues = (principal: unknown): readonly string[] => {
  if (!principal) {
    return [];
  }

  if (typeof principal === 'string') {
    return [principal];
  }

  if (Array.isArray(principal)) {
    return principal.flatMap(findPrincipalValues);
  }

  if (typeof principal !== 'object') {
    return [];
  }

  return Object.values(principal).flatMap(findPrincipalValues);
};

const isRootPrincipal = (principal: string): boolean => {
  return /^arn:[^:]+:iam::\d{12}:root$/.test(principal) || /^\d{12}$/.test(principal);
};

const findPrincipalObjects = (statement: PolicyStatement): readonly PrincipalObject[] => {
  return statement.principals as readonly PrincipalObject[];
};

const isRootPrincipalObject = (principal: PrincipalObject): boolean => {
  return principal.constructor?.name === 'AccountRootPrincipal';
};

const isWildcardPrincipalObject = (principal: PrincipalObject): boolean => {
  return (
    principal.constructor?.name === 'AnyPrincipal' ||
    principal.dedupeString?.() === 'ArnPrincipal:*'
  );
};

const validateStatement = (
  statement: PolicyStatement,
  statementIndex: number,
  options: IamPolicyValidationOptions,
): readonly IamPolicyValidationFinding[] => {
  const statementJson = statement.toStatementJson() as PolicyStatementJson;
  const findings: IamPolicyValidationFinding[] = [];
  const actions = toArray(statementJson.Action);
  const resources = toArray(statementJson.Resource);
  const notActions = toArray(statementJson.NotAction);
  const notResources = toArray(statementJson.NotResource);
  const principalValues = findPrincipalValues(statementJson.Principal);
  const principalObjects = findPrincipalObjects(statement);

  if (!statementJson.Sid?.trim()) {
    findings.push({
      code: IamPolicyValidationFindingCode.MISSING_SID,
      message: 'Policy statements must include a Sid.',
      statementIndex,
    });
  }

  if (actions.length === 0 && notActions.length === 0) {
    findings.push({
      code: IamPolicyValidationFindingCode.EMPTY_STATEMENT,
      message: 'Policy statement must include Action values.',
      statementIndex,
    });
  }

  notActions.forEach((notAction) => {
    findings.push({
      code: IamPolicyValidationFindingCode.NOT_ACTION,
      message: 'NotAction is not allowed by the least-privilege validator.',
      statementIndex,
      value: notAction,
    });
  });

  notResources.forEach((notResource) => {
    findings.push({
      code: IamPolicyValidationFindingCode.NOT_RESOURCE,
      message: 'NotResource is not allowed by the least-privilege validator.',
      statementIndex,
      value: notResource,
    });
  });

  actions.filter(hasActionWildcard).forEach((action) => {
    findings.push({
      code: IamPolicyValidationFindingCode.WILDCARD_ACTION,
      message: 'Wildcard IAM actions are not allowed.',
      statementIndex,
      value: action,
    });
  });

  resources.filter(isWildcardResource).forEach((resource) => {
    if (isAllowed(resource, options.allowWildcardResources)) {
      return;
    }

    findings.push({
      code: IamPolicyValidationFindingCode.WILDCARD_RESOURCE,
      message: 'Resource "*" is not allowed without an explicit exception.',
      statementIndex,
      value: resource,
    });
  });

  principalValues.forEach((principal) => {
    if (principal === '*') {
      findings.push({
        code: IamPolicyValidationFindingCode.WILDCARD_PRINCIPAL,
        message: 'Wildcard principals are not allowed.',
        statementIndex,
        value: principal,
      });
    }

    if (isRootPrincipal(principal)) {
      findings.push({
        code: IamPolicyValidationFindingCode.ROOT_PRINCIPAL,
        message: 'Account root principals are not allowed.',
        statementIndex,
        value: principal,
      });
    }
  });

  principalObjects.forEach((principal) => {
    if (isWildcardPrincipalObject(principal)) {
      findings.push({
        code: IamPolicyValidationFindingCode.WILDCARD_PRINCIPAL,
        message: 'Wildcard principals are not allowed.',
        statementIndex,
      });
    }

    if (isRootPrincipalObject(principal)) {
      findings.push({
        code: IamPolicyValidationFindingCode.ROOT_PRINCIPAL,
        message: 'Account root principals are not allowed.',
        statementIndex,
      });
    }
  });

  return findings;
};

const findDuplicateSidFindings = (
  policyStatements: readonly PolicyStatement[],
): readonly IamPolicyValidationFinding[] => {
  const seenSids = new Map<string, number>();
  const findings: IamPolicyValidationFinding[] = [];

  policyStatements.forEach((policyStatement, statementIndex) => {
    const sid = resolveStatementSid(policyStatement);

    if (!sid) {
      return;
    }

    const firstStatementIndex = seenSids.get(sid);

    if (firstStatementIndex === undefined) {
      seenSids.set(sid, statementIndex);
      return;
    }

    findings.push({
      code: IamPolicyValidationFindingCode.DUPLICATE_SID,
      message: `Policy statement Sid must be unique; first used by statement ${firstStatementIndex}.`,
      statementIndex,
      value: sid,
    });
  });

  return findings;
};

export const validatePolicyStatements = (
  policyStatements: readonly PolicyStatement[],
  options: IamPolicyValidationOptions = {},
): readonly IamPolicyValidationFinding[] => {
  return [
    ...policyStatements.flatMap((policyStatement, statementIndex) => {
      return validateStatement(policyStatement, statementIndex, options);
    }),
    ...findDuplicateSidFindings(policyStatements),
  ];
};

export const assertLeastPrivilegePolicyStatements = (
  policyStatements: readonly PolicyStatement[],
  options: IamPolicyValidationOptions = {},
): void => {
  const findings = validatePolicyStatements(policyStatements, options);

  if (findings.length === 0) {
    return;
  }

  const messages = findings.map((finding) => {
    const value = finding.value ? ` (${finding.value})` : '';

    return `${finding.code} statement ${finding.statementIndex}${value}: ${finding.message}`;
  });

  throw new Error(`IAM policy validation failed:\n${messages.join('\n')}`);
};
