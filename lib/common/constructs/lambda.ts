import { Architecture, LayerVersion, LayerVersionProps, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export const architecture = Architecture.ARM_64;

export const nodejsRuntime = Runtime.NODEJS_22_X;

export class CommonNodejsLayerVersion extends LayerVersion {
    constructor(
        scope: Construct,
        id: string,
        props: Omit<LayerVersionProps, "compatibleArchitectures" | "compatibleRuntimes">
    ) {
        super(scope, id, {
            compatibleArchitectures: [architecture],
            compatibleRuntimes: [nodejsRuntime],
            ...props,
        });
    }
}

export class CommonNodejsFunction extends NodejsFunction {
    constructor(
        scope: Construct,
        id: string,
        props: Omit<NodejsFunctionProps, "architecture" | "runtime" | "logRetention">
    ) {
        super(scope, id, {
            architecture,
            runtime: nodejsRuntime,
            ...props,
        });
    }
}
