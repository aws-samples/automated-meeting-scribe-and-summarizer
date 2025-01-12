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
    scribe
    status
    users
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
      scribe
      status
      users
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
export const meetingsByIdAndPlatformAndPasswordAndTime = /* GraphQL */ `query MeetingsByIdAndPlatformAndPasswordAndTime(
  $id: String!
  $platformPasswordTime: ModelMeetingMeetingIndexCompositeKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelMeetingFilterInput
  $limit: Int
  $nextToken: String
) {
  meetingsByIdAndPlatformAndPasswordAndTime(
    id: $id
    platformPasswordTime: $platformPasswordTime
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      uid
      name
      id
      platform
      password
      time
      scribe
      status
      users
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MeetingsByIdAndPlatformAndPasswordAndTimeQueryVariables,
  APITypes.MeetingsByIdAndPlatformAndPasswordAndTimeQuery
>;
