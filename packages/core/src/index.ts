import { CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export * from './environment.js';
export * from './overrides.js';
export * from './tags.js';

export type LibraryInfoProps = {
  readonly value?: string;
};

export class LibraryInfo extends Construct {
  public constructor(scope: Construct, id: string, props: LibraryInfoProps = {}) {
    super(scope, id);

    new CfnOutput(this, 'LibraryInfo', {
      value: props.value ?? Stack.of(this).stackName,
    });
  }
}
