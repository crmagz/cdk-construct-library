export const EnvironmentName = {
  DEV: 'dev',
  STAGING: 'staging',
  PROD: 'prod',
} as const;

export type EnvironmentName = (typeof EnvironmentName)[keyof typeof EnvironmentName];
export type EnvironmentNameLike = EnvironmentName | (string & {});
export type AwsAccountId = string;
export type AwsRegion = string;

export type DeploymentEnvironment = {
  readonly name: EnvironmentNameLike;
  readonly account?: AwsAccountId;
  readonly region?: AwsRegion;
};

export type EnvironmentConfig = {
  readonly env: DeploymentEnvironment;
};

export type EnvironmentInput = EnvironmentNameLike | DeploymentEnvironment | EnvironmentConfig;

export type EnvironmentAwareProps = EnvironmentConfig;

const productionNames = new Set<string>([EnvironmentName.PROD, 'production']);

const isEnvironmentConfig = (environment: EnvironmentInput): environment is EnvironmentConfig => {
  return typeof environment === 'object' && 'env' in environment;
};

const missingEnvironmentError = (): Error => {
  return new Error(
    'Environment config is required. Pass props.env with at least an environment name.',
  );
};

export const resolveEnvironmentName = (
  environment: EnvironmentInput | undefined,
): EnvironmentNameLike => {
  if (environment === undefined) {
    throw missingEnvironmentError();
  }

  if (typeof environment === 'string') {
    return environment;
  }

  return isEnvironmentConfig(environment) ? environment.env.name : environment.name;
};

export const resolveEnvironmentConfig = (
  environment: EnvironmentInput | undefined,
): DeploymentEnvironment => {
  if (environment === undefined) {
    throw missingEnvironmentError();
  }

  if (typeof environment === 'string') {
    return { name: environment };
  }

  return isEnvironmentConfig(environment) ? environment.env : environment;
};

export const resolveEnvironmentNameOrDefault = (
  environment: EnvironmentInput | undefined,
  defaultEnvironment: EnvironmentNameLike,
): EnvironmentNameLike => {
  return environment === undefined ? defaultEnvironment : resolveEnvironmentName(environment);
};

export const resolveEnvironmentConfigOrDefault = (
  environment: EnvironmentInput | undefined,
  defaultEnvironment: EnvironmentNameLike | DeploymentEnvironment,
): DeploymentEnvironment => {
  if (environment !== undefined) {
    return resolveEnvironmentConfig(environment);
  }

  return typeof defaultEnvironment === 'string' ? { name: defaultEnvironment } : defaultEnvironment;
};

export const resolveAwsEnvironment = (
  environment: EnvironmentInput | undefined,
): { readonly account?: AwsAccountId; readonly region?: AwsRegion } => {
  const { account, region } = resolveEnvironmentConfig(environment);

  return { account, region };
};

export const isProductionEnvironment = (environment: EnvironmentInput | undefined): boolean => {
  return productionNames.has(resolveEnvironmentName(environment).toLowerCase());
};

export const isNonProductionEnvironment = (environment: EnvironmentInput | undefined): boolean => {
  return !isProductionEnvironment(environment);
};
