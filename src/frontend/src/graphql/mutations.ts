/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../details";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createMeeting = /* GraphQL */ `mutation CreateMeeting(
  $input: CreateMeetingInput!
  $condition: ModelMeetingConditionInput
) {
  createMeeting(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateMeetingMutationVariables,
  APITypes.CreateMeetingMutation
>;
export const updateMeeting = /* GraphQL */ `mutation UpdateMeeting(
  $input: UpdateMeetingInput!
  $condition: ModelMeetingConditionInput
) {
  updateMeeting(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateMeetingMutationVariables,
  APITypes.UpdateMeetingMutation
>;
export const deleteMeeting = /* GraphQL */ `mutation DeleteMeeting(
  $input: DeleteMeetingInput!
  $condition: ModelMeetingConditionInput
) {
  deleteMeeting(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteMeetingMutationVariables,
  APITypes.DeleteMeetingMutation
>;
