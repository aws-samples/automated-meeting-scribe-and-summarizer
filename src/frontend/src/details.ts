/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateMeetingInput = {
  uid: string,
  name: string,
  id?: string | null,
  platform: string,
  password?: string | null,
  time: number,
  scribe?: string | null,
  status?: string | null,
  users?: Array< string | null > | null,
};

export type ModelMeetingConditionInput = {
  name?: ModelStringInput | null,
  platform?: ModelStringInput | null,
  password?: ModelStringInput | null,
  time?: ModelIntInput | null,
  scribe?: ModelStringInput | null,
  status?: ModelStringInput | null,
  users?: ModelStringInput | null,
  and?: Array< ModelMeetingConditionInput | null > | null,
  or?: Array< ModelMeetingConditionInput | null > | null,
  not?: ModelMeetingConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Meeting = {
  __typename: "Meeting",
  uid: string,
  name: string,
  id: string,
  platform: string,
  password?: string | null,
  time: number,
  scribe?: string | null,
  status?: string | null,
  users?: Array< string | null > | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateMeetingInput = {
  uid: string,
  name?: string | null,
  id?: string | null,
  platform?: string | null,
  password?: string | null,
  time?: number | null,
  scribe?: string | null,
  status?: string | null,
  users?: Array< string | null > | null,
};

export type DeleteMeetingInput = {
  uid: string,
};

export type ModelMeetingFilterInput = {
  uid?: ModelIDInput | null,
  name?: ModelStringInput | null,
  id?: ModelStringInput | null,
  platform?: ModelStringInput | null,
  password?: ModelStringInput | null,
  time?: ModelIntInput | null,
  scribe?: ModelStringInput | null,
  status?: ModelStringInput | null,
  users?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelMeetingFilterInput | null > | null,
  or?: Array< ModelMeetingFilterInput | null > | null,
  not?: ModelMeetingFilterInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelMeetingConnection = {
  __typename: "ModelMeetingConnection",
  items:  Array<Meeting | null >,
  nextToken?: string | null,
};

export type ModelMeetingMeetingIndexCompositeKeyConditionInput = {
  eq?: ModelMeetingMeetingIndexCompositeKeyInput | null,
  le?: ModelMeetingMeetingIndexCompositeKeyInput | null,
  lt?: ModelMeetingMeetingIndexCompositeKeyInput | null,
  ge?: ModelMeetingMeetingIndexCompositeKeyInput | null,
  gt?: ModelMeetingMeetingIndexCompositeKeyInput | null,
  between?: Array< ModelMeetingMeetingIndexCompositeKeyInput | null > | null,
  beginsWith?: ModelMeetingMeetingIndexCompositeKeyInput | null,
};

export type ModelMeetingMeetingIndexCompositeKeyInput = {
  platform?: string | null,
  password?: string | null,
  time?: number | null,
};

export type ModelSubscriptionMeetingFilterInput = {
  uid?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  platform?: ModelSubscriptionStringInput | null,
  password?: ModelSubscriptionStringInput | null,
  time?: ModelSubscriptionIntInput | null,
  scribe?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionMeetingFilterInput | null > | null,
  or?: Array< ModelSubscriptionMeetingFilterInput | null > | null,
  users?: ModelStringInput | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type CreateMeetingMutationVariables = {
  input: CreateMeetingInput,
  condition?: ModelMeetingConditionInput | null,
};

export type CreateMeetingMutation = {
  createMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateMeetingMutationVariables = {
  input: UpdateMeetingInput,
  condition?: ModelMeetingConditionInput | null,
};

export type UpdateMeetingMutation = {
  updateMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteMeetingMutationVariables = {
  input: DeleteMeetingInput,
  condition?: ModelMeetingConditionInput | null,
};

export type DeleteMeetingMutation = {
  deleteMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type GetMeetingQueryVariables = {
  uid: string,
};

export type GetMeetingQuery = {
  getMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListMeetingsQueryVariables = {
  uid?: string | null,
  filter?: ModelMeetingFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListMeetingsQuery = {
  listMeetings?:  {
    __typename: "ModelMeetingConnection",
    items:  Array< {
      __typename: "Meeting",
      uid: string,
      name: string,
      id: string,
      platform: string,
      password?: string | null,
      time: number,
      scribe?: string | null,
      status?: string | null,
      users?: Array< string | null > | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type MeetingsByIdAndPlatformAndPasswordAndTimeQueryVariables = {
  id: string,
  platformPasswordTime?: ModelMeetingMeetingIndexCompositeKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelMeetingFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type MeetingsByIdAndPlatformAndPasswordAndTimeQuery = {
  meetingsByIdAndPlatformAndPasswordAndTime?:  {
    __typename: "ModelMeetingConnection",
    items:  Array< {
      __typename: "Meeting",
      uid: string,
      name: string,
      id: string,
      platform: string,
      password?: string | null,
      time: number,
      scribe?: string | null,
      status?: string | null,
      users?: Array< string | null > | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateMeetingSubscriptionVariables = {
  filter?: ModelSubscriptionMeetingFilterInput | null,
};

export type OnCreateMeetingSubscription = {
  onCreateMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateMeetingSubscriptionVariables = {
  filter?: ModelSubscriptionMeetingFilterInput | null,
};

export type OnUpdateMeetingSubscription = {
  onUpdateMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteMeetingSubscriptionVariables = {
  filter?: ModelSubscriptionMeetingFilterInput | null,
};

export type OnDeleteMeetingSubscription = {
  onDeleteMeeting?:  {
    __typename: "Meeting",
    uid: string,
    name: string,
    id: string,
    platform: string,
    password?: string | null,
    time: number,
    scribe?: string | null,
    status?: string | null,
    users?: Array< string | null > | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};
