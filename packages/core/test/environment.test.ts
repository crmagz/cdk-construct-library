import {
  EnvironmentName,
  isNonProductionEnvironment,
  isProductionEnvironment,
  resolveAwsEnvironment,
  resolveEnvironmentConfig,
  resolveEnvironmentConfigOrDefault,
  resolveEnvironmentName,
  resolveEnvironmentNameOrDefault,
  standardTags,
} from '../src/index.js';

describe('environment helpers', () => {
  it('requires environment config by default', () => {
    expect(() => resolveEnvironmentName(undefined)).toThrow('Environment config is required');
    expect(() => resolveEnvironmentConfig(undefined)).toThrow('Environment config is required');
    expect(() => isProductionEnvironment(undefined)).toThrow('Environment config is required');
  });

  it('accepts environment names, environment objects, and props objects', () => {
    expect(resolveEnvironmentName(EnvironmentName.DEV)).toBe(EnvironmentName.DEV);
    expect(
      resolveEnvironmentConfig({
        env: {
          name: EnvironmentName.STAGING,
          account: '123456789012',
          region: 'us-east-1',
        },
      }),
    ).toEqual({
      name: EnvironmentName.STAGING,
      account: '123456789012',
      region: 'us-east-1',
    });
  });

  it('treats prod and production as production names', () => {
    expect(isProductionEnvironment(EnvironmentName.PROD)).toBe(true);
    expect(isProductionEnvironment('production')).toBe(true);
    expect(isProductionEnvironment(EnvironmentName.DEV)).toBe(false);
    expect(isNonProductionEnvironment(EnvironmentName.DEV)).toBe(true);
  });

  it('creates standard tags without requiring them', () => {
    expect(
      standardTags({
        env: { name: EnvironmentName.DEV },
        application: 'billing',
        additionalTags: {
          Owner: 'platform',
        },
      }),
    ).toEqual({
      Environment: EnvironmentName.DEV,
      Application: 'billing',
      Owner: 'platform',
    });
  });

  it('supports explicit fallback helpers when callers choose defaults', () => {
    expect(resolveEnvironmentNameOrDefault(undefined, EnvironmentName.PROD)).toBe(
      EnvironmentName.PROD,
    );
    expect(resolveEnvironmentConfigOrDefault(undefined, EnvironmentName.DEV)).toEqual({
      name: EnvironmentName.DEV,
    });
  });

  it('resolves CDK stack environment account and region from props', () => {
    expect(
      resolveAwsEnvironment({
        env: {
          name: EnvironmentName.PROD,
          account: '123456789012',
          region: 'us-east-1',
        },
      }),
    ).toEqual({
      account: '123456789012',
      region: 'us-east-1',
    });
  });
});
