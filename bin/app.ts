import { App } from "aws-cdk-lib";
import AuthStack from "../lib/auth";
import ApiStack from "../lib/api";
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();
const name = process.env.STACK_NAME || "Scribe";
const regionConfig = {
    env: {
        region: process.env.AWS_REGION || "us-east-1",
    },
    crossRegionReferences: true,
};

const authStack = new AuthStack(app, `${name}-Auth`, {
    ...regionConfig,
});

const apiStack = new ApiStack(app, `${name}-Api`, {
    userPool: authStack.userPool,
    ...regionConfig,
});

new FrontendStack(app, `${name}-Frontend`, {
    userPoolId: authStack.userPool.userPoolId,
    userPoolClientId: authStack.userPoolClient.userPoolClientId,
    graphApiUrl: apiStack.graphApi.graphqlUrl,
    env: {
        region: "us-east-1",
    },
    crossRegionReferences: true,
});

new BackendStack(app, `${name}-Backend`, {
    identity: authStack.identity,
    graphApi: apiStack.graphApi,
    ...regionConfig,
});
