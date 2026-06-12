export type CdkOverrides<TProps extends object> = Partial<TProps>;

export type OverrideProps<TProps extends object> = {
  readonly overrides?: CdkOverrides<TProps>;
};
