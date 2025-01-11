/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateInvite = {
  name: string,
  meeting: MeetingInput,
};

export type MeetingInput = {
  platform: string,
  id: string,
  password: string,
  time: number,
};

export type Invite = {
  __typename: "Invite",
  name: string,
  meeting: Meeting,
  scribe: string,
  status: string,
};

export type Meeting = {
  __typename: "Meeting",
  platform: string,
  id: string,
  password: string,
  time: number,
};

export type CreateInviteMutationVariables = {
  input: CreateInvite,
};

export type CreateInviteMutation = {
  createInvite?: string | null,
};

export type DeleteInviteMutationVariables = {
  input: MeetingInput,
};

export type DeleteInviteMutation = {
  deleteInvite?: string | null,
};

export type GetInvitesQueryVariables = {
};

export type GetInvitesQuery = {
  getInvites?:  Array< {
    __typename: "Invite",
    name: string,
    meeting:  {
      __typename: "Meeting",
      platform: string,
      id: string,
      password: string,
      time: number,
    },
    scribe: string,
    status: string,
  } | null > | null,
};
