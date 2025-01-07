
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

export type Speaker = {
    name: string;
    timestamp: number;
}

export class Details {
    private client: DynamoDBClient;
    constructor() {
        this.client = new DynamoDBClient({});
        this.queryMeeting();
    }

    public meeting = process.env.MEETING!
    public meeting_platform: string = this.meeting.split('#')[0];
    public meeting_id: string = this.meeting.split('#')[1];
    public meeting_password: string = this.meeting.split('#')[2];
    public meeting_time: number = parseInt(this.meeting.split('#')[3]);

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

        const emailDestinations = response.Items?.map((item: any) => item.pk.S) || [];

        let emailStrings = ''
        if (emailDestinations.length === 1) {
            emailStrings = emailDestinations[0];
        } else if (emailDestinations.length === 2) {
            emailStrings = `${emailDestinations[0]} and ${emailDestinations[1]}`;
        } else if (emailDestinations.length > 2) {
            emailStrings = `${emailDestinations.slice(0, -1).join(", ")}, and ${emailDestinations.slice(-1)}`;
        }

        this.meetingNames = response.Items?.map((item: any) => item.meeting_name.S) || [];
        this.emailDestinations = emailDestinations;
        this.intro_messages = [
            `Hello! I am Amazon's AI-assisted scribe. I was invited by ${emailStrings}.`,
            `If all other participants consent to my use, send "${this.start_command}" in the chat ` +
            `to start saving new speakers, messages, and machine-generated captions.`,
            `If you do not consent to my use, send "${this.end_command}" in the chat ` +
            `to remove me from this meeting.`
        ]
    }

    public scribe_name: string = process.env.SCRIBE_NAME || '';
    public scribe_identity: string = `Scribe [${this.scribe_name}]`;

    public waiting_timeout: number = 300000;  // 5 minutes
    public meeting_timeout: number = 21600000;  // 6 hours

    public start: boolean = false;

    public start_command: string = 'START';
    public pause_command: string = 'PAUSE';
    public end_command: string = 'END';

    public intro_messages: string[] = [];
    public start_messages: string[] = [
        'Saving new speakers, messages, and machine-generated captions.',
        `Send "${this.pause_command}" in the chat to stop saving meeting details.`
    ];
    public pause_messages: string[] = [
        'Not saving speakers, messages, or machine-generated captions.',
        `Send "${this.start_command}" in the chat to start saving meeting details.`
    ];

    public messages: string[] = [];
    public attachments: Record<string, string> = {};
    public captions: string[] = [];
    public speakers: Speaker[] = [];

}

export const details = new Details();
