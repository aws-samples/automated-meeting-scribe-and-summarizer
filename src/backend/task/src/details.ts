import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

export type Speaker = {
    name: string;
    timestamp: number;
};

export class Details {
    public inviteName!: string;
    public meetingPlatform!: string;
    public meetingId!: string;
    public meetingPassword?: string;
    public meetingTime!: number;

    public emailDestinations!: string[];
    private emailStrings!: string;

    public scribeName: string = "Scribe";
    public scribeIdentity!: string;

    public waitingTimeout: number = 300000; // 5 minutes
    public meetingTimeout: number = 21600000; // 6 hours

    public start: boolean = false;

    public startCommand: string = "START";
    public pauseCommand: string = "PAUSE";
    public endCommand: string = "END";

    public introMessages!: string[];
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

    public async queryInvite() {
        const client = new DynamoDBClient({});
        const response = await client.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "id = :id",
                ExpressionAttributeValues: {
                    ":id": { S: process.env.INVITE_ID! },
                },
            })
        );
        const invite = response.Items![0];

        this.inviteName = invite["name"].S!;
        this.meetingPlatform = invite["meetingPlatform"].S!;
        this.meetingId = invite["meetingId"].S!;
        this.meetingTime = parseInt(invite["meetingTime"].N!);
        this.meetingPassword = invite["meetingPassword"]?.S;

        const emailDestinations = invite["users"].L!.map((user) => user.S!);
        this.emailDestinations = emailDestinations;
        if (emailDestinations.length === 1) {
            this.emailStrings = emailDestinations[0];
        } else if (emailDestinations.length === 2) {
            this.emailStrings = `${emailDestinations[0]} and ${emailDestinations[1]}`;
        } else if (emailDestinations.length > 2) {
            this.emailStrings = `${emailDestinations
                .slice(0, -1)
                .join(", ")}, and ${emailDestinations.slice(-1)}`;
        }

        this.scribeIdentity = `${this.scribeName} [${emailDestinations[0]}]`;

        this.introMessages = [
            `Hello! I am an AI-assisted scribe. I was invited by ${this.emailStrings}.`,
            `If all other participants consent to my use, send "${this.startCommand}" in the chat ` +
                `to start saving new speakers, messages, and machine-generated captions.`,
            `If you do not consent to my use, send "${this.endCommand}" in the chat ` +
                `to remove me from this meeting.`,
        ];
    }
}

export const details = new Details();
