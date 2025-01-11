/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../details";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getInvites = /* GraphQL */ `query GetInvites {
  getInvites {
    name
    platform
    id
    password
    time
    status
    scribe
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetInvitesQueryVariables,
  APITypes.GetInvitesQuery
>;
