/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getInvite = /* GraphQL */ `query GetInvite($id: ID!) {
  getInvite(id: $id) {
    name
    meetingPlatform
    meetingId
    meetingPassword
    meetingTime
    status
    users
    id
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetInviteQueryVariables, APITypes.GetInviteQuery>;
export const listInvites = /* GraphQL */ `query ListInvites(
  $filter: ModelInviteFilterInput
  $limit: Int
  $nextToken: String
) {
  listInvites(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      name
      meetingPlatform
      meetingId
      meetingPassword
      meetingTime
      status
      users
      id
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListInvitesQueryVariables,
  APITypes.ListInvitesQuery
>;
