import { CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface LibraryInfoProps {
  readonly value?: string;
}

export class LibraryInfo extends Construct {
  public constructor(scope: Construct, id: string, props: LibraryInfoProps = {}) {
    super(scope, id);

    new CfnOutput(this, 'LibraryInfo', {
      value: props.value ?? Stack.of(this).stackName,
    });
  }
}
