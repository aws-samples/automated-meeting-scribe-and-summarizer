/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateInvite = /* GraphQL */ `subscription OnCreateInvite($filter: ModelSubscriptionInviteFilterInput) {
  onCreateInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateInviteSubscriptionVariables,
  APITypes.OnCreateInviteSubscription
>;
export const onUpdateInvite = /* GraphQL */ `subscription OnUpdateInvite($filter: ModelSubscriptionInviteFilterInput) {
  onUpdateInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateInviteSubscriptionVariables,
  APITypes.OnUpdateInviteSubscription
>;
export const onDeleteInvite = /* GraphQL */ `subscription OnDeleteInvite($filter: ModelSubscriptionInviteFilterInput) {
  onDeleteInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteInviteSubscriptionVariables,
  APITypes.OnDeleteInviteSubscription
>;
