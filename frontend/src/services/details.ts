
import create from "./http"

export interface Schedule {
    Name: string,
    Description: string,
    ScheduleExpression: string
}

export default (endpoint: string, idToken: string) => {
    if (idToken.length === 0)
        return
    return create(endpoint, idToken)
}

export interface MeetingPlatform {
    label: string;
    disabled: boolean;
    value: string;
}

export const meetingPlatforms: MeetingPlatform[] = [
    { label: "Amazon Chime", disabled: false, value: "Chime" },
    { label: "Zoom", disabled: false, value: "Zoom" },
    { label: "Microsoft Teams", disabled: true, value: "Teams" },
    { label: "Google Meet", disabled: true, value: "Meet" }
]
