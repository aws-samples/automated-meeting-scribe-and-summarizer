
import {
  App,
} from "aws-cdk-lib";
import BaseStack from '../lib/base';
import FrontendStack from "../lib/frontend";
import BackendStack from "../lib/backend";

const app = new App();

const base_stack = new BaseStack(app, 'BaseStack', {});

new FrontendStack(app, 'FrontendStack', {
  logging_bucket: base_stack.logging_bucket,
  email: base_stack.email.valueAsString,
  table: base_stack.table,
});

new BackendStack(app, 'BackendStack', {
  email: base_stack.email.valueAsString,
  table: base_stack.table,
  index: base_stack.index,
});
