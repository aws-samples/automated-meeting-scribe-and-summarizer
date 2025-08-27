export type MeetingPlatform = {
    label: string;
    disabled: boolean;
    value: string;
};

export const meetingPlatforms: MeetingPlatform[] = [
    { label: "Amazon Chime", disabled: false, value: "Chime" },
    { label: "Webex", disabled: false, value: "Webex" },
];
