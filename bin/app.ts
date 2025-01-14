import { App } from "aws-cdk-lib";
import AuthStack from "../lib/auth";
import ApiStack from "../lib/api";
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();
const name = process.env.STACK_NAME || "Scribe";

const authStack = new AuthStack(app, `${name}-Auth`, {});

const apiStack = new ApiStack(app, `${name}-Api`, {
    userPool: authStack.userPool,
});

new FrontendStack(app, `${name}-Frontend`, {
    userPoolId: authStack.userPool.userPoolId,
    userPoolClientId: authStack.userPoolClient.userPoolClientId,
    graphApiUrl: apiStack.graphApi.graphqlUrl,
});

new BackendStack(app, `${name}-Backend`, {
    identity: authStack.identity,
    graphApi: apiStack.graphApi,
});
