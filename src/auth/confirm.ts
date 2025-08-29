import { SESClient, VerifyEmailIdentityCommand } from "@aws-sdk/client-ses";
import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PostConfirmationTriggerEvent } from "aws-lambda";

const sesV2Client = new SESv2Client();
const sesClient = new SESClient();

export const handler = async (event: PostConfirmationTriggerEvent) => {
    const account = await sesV2Client.send(new GetAccountCommand());
    if (!account.ProductionAccessEnabled) {
        console.log("SES is sandboxed.");
        await sesClient.send(
            new VerifyEmailIdentityCommand({
                EmailAddress: event.request.userAttributes.email,
            })
        );
    }
    return event;
};
