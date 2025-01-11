import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

export type Speaker = {
    name: string;
    timestamp: number;
};

export class Details {
    private client: DynamoDBClient;
    constructor() {
        this.client = new DynamoDBClient({});
        this.queryMeeting();
    }

    public meeting = process.env.MEETING!;
    public meetingPlatform: string = this.meeting.split("#")[0];
    public meetingId: string = this.meeting.split("#")[1];
    public meetingPassword: string = this.meeting.split("#")[2];
    public meetingTime: number = parseInt(this.meeting.split("#")[3]);

    public emailDestinations: string[] = [];
    public meetingNames: string[] = [];
    public async queryMeeting() {
        const response = await this.client.send(
            new QueryCommand({
                TableName: process.env.TABLE,
                IndexName: process.env.MEETING_INDEX,
                KeyConditionExpression: "sk = :meeting",
                ExpressionAttributeValues: {
                    ":meeting": { S: this.meeting },
                },
                ProjectionExpression: "pk, meeting_name",
            })
        );

        const emailDestinations =
            response.Items?.map((item: any) => item.pk.S) || [];

        let emailStrings = "";
        if (emailDestinations.length === 1) {
            emailStrings = emailDestinations[0];
        } else if (emailDestinations.length === 2) {
            emailStrings = `${emailDestinations[0]} and ${emailDestinations[1]}`;
        } else if (emailDestinations.length > 2) {
            emailStrings = `${emailDestinations
                .slice(0, -1)
                .join(", ")}, and ${emailDestinations.slice(-1)}`;
        }

        this.meetingNames =
            response.Items?.map((item: any) => item.meeting_name.S) || [];
        this.emailDestinations = emailDestinations;
        this.introMessages = [
            `Hello! I am an AI-assisted scribe. I was invited by ${emailStrings}.`,
            `If all other participants consent to my use, send "${this.startCommand}" in the chat ` +
                `to start saving new speakers, messages, and machine-generated captions.`,
            `If you do not consent to my use, send "${this.endCommand}" in the chat ` +
                `to remove me from this meeting.`,
        ];
    }

    public scribeName: string = process.env.SCRIBE_NAME || "";
    public scribeIdentity: string = `Scribe [${this.scribeName}]`;

    public waitingTimeout: number = 300000; // 5 minutes
    public meetingTimeout: number = 21600000; // 6 hours

    public start: boolean = false;

    public startCommand: string = "START";
    public pauseCommand: string = "PAUSE";
    public endCommand: string = "END";

    public introMessages: string[] = [];
    public startMessages: string[] = [
        "Saving new speakers, messages, and machine-generated captions.",
        `Send "${this.pauseCommand}" in the chat to stop saving meeting details.`,
    ];
    public pauseMessages: string[] = [
        "Not saving speakers, messages, or machine-generated captions.",
        `Send "${this.startCommand}" in the chat to start saving meeting details.`,
    ];

    public messages: string[] = [];
    public attachments: Record<string, string> = {};
    public captions: string[] = [];
    public speakers: Speaker[] = [];
}

export const details = new Details();
