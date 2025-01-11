/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../details";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createInvite = /* GraphQL */ `mutation CreateInvite($input: CreateInvite!) {
  createInvite(input: $input)
}
` as GeneratedMutation<
  APITypes.CreateInviteMutationVariables,
  APITypes.CreateInviteMutation
>;
export const deleteInvite = /* GraphQL */ `mutation DeleteInvite($input: DeleteInvite!) {
  deleteInvite(input: $input)
}
` as GeneratedMutation<
  APITypes.DeleteInviteMutationVariables,
  APITypes.DeleteInviteMutation
>;
export const updateInvite = /* GraphQL */ `mutation UpdateInvite($input: UpdateInvite!) {
  updateInvite(input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateInviteMutationVariables,
  APITypes.UpdateInviteMutation
>;
