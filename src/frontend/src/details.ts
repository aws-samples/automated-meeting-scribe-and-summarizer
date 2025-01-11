/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateInvite = {
  name: string,
  platform: string,
  id: string,
  password?: string | null,
  time: number,
};

export type DeleteInvite = {
  platform: string,
  id: string,
  password?: string | null,
  time: number,
};

export type UpdateInvite = {
  email: string,
  platform: string,
  id: string,
  password?: string | null,
  time: number,
  status: string,
  scribe: string,
};

export type Invite = {
  __typename: "Invite",
  name: string,
  platform: string,
  id: string,
  password?: string | null,
  time: number,
  status: string,
  scribe?: string | null,
};

export type CreateInviteMutationVariables = {
  input: CreateInvite,
};

export type CreateInviteMutation = {
  createInvite?: string | null,
};

export type DeleteInviteMutationVariables = {
  input: DeleteInvite,
};

export type DeleteInviteMutation = {
  deleteInvite?: string | null,
};

export type UpdateInviteMutationVariables = {
  input: UpdateInvite,
};

export type UpdateInviteMutation = {
  updateInvite?:  {
    __typename: "Invite",
    name: string,
    platform: string,
    id: string,
    password?: string | null,
    time: number,
    status: string,
    scribe?: string | null,
  } | null,
};

export type GetInvitesQueryVariables = {
};

export type GetInvitesQuery = {
  getInvites?:  Array< {
    __typename: "Invite",
    name: string,
    platform: string,
    id: string,
    password?: string | null,
    time: number,
    status: string,
    scribe?: string | null,
  } | null > | null,
};
