/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../details";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getMeeting = /* GraphQL */ `query GetMeeting($uid: ID!) {
  getMeeting(uid: $uid) {
    uid
    name
    id
    platform
    password
    time
    status
    user
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetMeetingQueryVariables,
  APITypes.GetMeetingQuery
>;
export const listMeetings = /* GraphQL */ `query ListMeetings(
  $uid: ID
  $filter: ModelMeetingFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listMeetings(
    uid: $uid
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      uid
      name
      id
      platform
      password
      time
      status
      user
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListMeetingsQueryVariables,
  APITypes.ListMeetingsQuery
>;
