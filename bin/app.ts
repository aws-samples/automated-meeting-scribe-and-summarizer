import { App } from "aws-cdk-lib";
import Api from "../lib/stacks/api";
import Auth from "../lib/stacks/auth";
import Backend from "../lib/stacks/backend";
import Frontend from "../lib/stacks/frontend";

const app = new App();
const name = process.env.STACK_NAME || "Scribe";

const auth = new Auth(app, `${name}-Auth`);

const api = new Api(app, `${name}-Api`, {
    userPool: auth.userPool,
    regionalWebAclArn: auth.regionalWebAclArn,
});

new Frontend(app, `${name}-Frontend`, {
    userPoolId: auth.userPool.userPoolId,
    userPoolClientId: auth.userPoolClient.userPoolClientId,
    graphApiUrl: api.amplifiedGraphApi.graphqlUrl,
});

new Backend(app, `${name}-Backend`, {
    identity: auth.identity,
    amplifiedGraphApi: api.amplifiedGraphApi,
});
