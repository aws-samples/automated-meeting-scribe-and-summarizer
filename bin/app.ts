import { App } from "aws-cdk-lib";
import BaseStack from "../lib/base";
import AuthStack from "../lib/auth";
import ApiStack from "../lib/api";
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();
const name = process.env.STACK_NAME || "Scribe";

const baseStack = new BaseStack(app, `${name}-Base`, {});

const authStack = new AuthStack(app, `${name}-Auth`, {
    email: baseStack.identity.emailIdentityName,
});

const apiStack = new ApiStack(app, `${name}-Api`, {
    userPool: authStack.userPool,
    table: baseStack.table,
});

new FrontendStack(app, `${name}-Frontend`, {
    loggingBucket: baseStack.loggingBucket,
    userPoolId: authStack.userPool.userPoolId,
    userPoolClientId: authStack.userPoolClient.userPoolClientId,
    graphApiUrl: apiStack.graphApi.graphqlUrl,
});

new BackendStack(app, `${name}-Backend`, {
    identity: baseStack.identity,
    table: baseStack.table,
    index: baseStack.index,
    graphApi: apiStack.graphApi,
});
