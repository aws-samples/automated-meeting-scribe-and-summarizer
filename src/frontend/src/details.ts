
export type Meeting = {
    platform: string,
    id: string,
    password?: string,
    name: string,
    time: number
}

export type Invite = Meeting & {
    scribe: string;
};

export type MeetingPlatform = {
    label: string,
    disabled: boolean,
    value: string
};

export const meetingPlatforms: MeetingPlatform[] = [
    { label: "Amazon Chime", disabled: false, value: "Chime" },
    { label: "Webex", disabled: false, value: "Webex" },
]
