/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../details";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateMeeting = /* GraphQL */ `subscription OnCreateMeeting($filter: ModelSubscriptionMeetingFilterInput) {
  onCreateMeeting(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateMeetingSubscriptionVariables,
  APITypes.OnCreateMeetingSubscription
>;
export const onUpdateMeeting = /* GraphQL */ `subscription OnUpdateMeeting($filter: ModelSubscriptionMeetingFilterInput) {
  onUpdateMeeting(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateMeetingSubscriptionVariables,
  APITypes.OnUpdateMeetingSubscription
>;
export const onDeleteMeeting = /* GraphQL */ `subscription OnDeleteMeeting($filter: ModelSubscriptionMeetingFilterInput) {
  onDeleteMeeting(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteMeetingSubscriptionVariables,
  APITypes.OnDeleteMeetingSubscription
>;
