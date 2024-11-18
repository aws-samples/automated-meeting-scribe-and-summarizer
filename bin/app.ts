
import {
  App,
} from "aws-cdk-lib";
import BaseStack from '../lib/base';
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();

const baseStack = new BaseStack(app, 'base', {});

new FrontendStack(app, 'frontend', {
  loggingBucket: baseStack.loggingBucket,
  email: baseStack.email.valueAsString,
  table: baseStack.table,
});

new BackendStack(app, 'backend', {
  email: baseStack.email.valueAsString,
  table: baseStack.table,
  index: baseStack.index,
});
