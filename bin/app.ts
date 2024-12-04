
import {
  App,
} from "aws-cdk-lib";
import BaseStack from '../lib/base';
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();
const name = process.env.STACK_NAME || 'Scribe';

const baseStack = new BaseStack(app, `${name}-Base`, {});

new FrontendStack(app, `${name}-Frontend`, {
  loggingBucket: baseStack.loggingBucket,
  email: baseStack.identity.emailIdentityName,
  table: baseStack.table,
});

new BackendStack(app, `${name}-Backend`, {
  identity: baseStack.identity,
  table: baseStack.table,
  index: baseStack.index,
});
