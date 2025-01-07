
import { Page, Frame } from 'playwright';
import { transcriptionService } from './scribe';
import { details } from './details';

export default class Webex {
    private readonly iframe = 'iframe[name="thinIframe"]';

    private async sendMessages(frame: Frame, messages: string[]): Promise<void> {
        const messageElement = await frame.waitForSelector(
            'textarea[placeholder="Type your message here"]'
        );
        for (const message of messages) {
            await messageElement?.type(message);
            await messageElement?.press("Enter");
        }
    }

    public async initialize(page: Page): Promise<void> {
        console.log("Getting meeting link.");
        await page.goto("https://signin.webex.com/join");

        console.log("Entering meeting ID.");
        const meetingTextElement = await page.waitForSelector("#join-meeting-form");
        await meetingTextElement?.type(details.meeting_id);
        await meetingTextElement?.press("Enter");

        console.log("Launching app.");
        try {
            await page.waitForSelector(".meet_message_H1");
            await page.goto(`${page.url()}?launchApp=true`);
        } catch {
            console.log("Your scribe was unable to join the meeting.");
            return;
        }

        const frameElement = await page.waitForSelector(this.iframe);
        const frame = await frameElement?.contentFrame();
        if (!frame) return;

        console.log("Entering name.");
        const nameTextElement = await frame.waitForSelector(
            'input[aria-labelledby="nameLabel"]'
        );
        await nameTextElement?.type(details.scribe_identity);

        console.log("Entering email.");
        const emailTextElement = await frame.waitForSelector(
            'input[aria-labelledby="emailLabel"]'
        );
        await emailTextElement?.type(process.env.EMAIL_SOURCE!);
        await emailTextElement?.press("Enter");

        console.log("Clicking cookie button.");
        const cookieButtonElement = await page.waitForSelector(".cookie-manage-close-handler");
        await cookieButtonElement?.click();

        console.log("Clicking mute button.");
        const muteButtonElement = await frame.waitForSelector('text="Mute"');
        await muteButtonElement?.click();

        console.log("Clicking video button.");
        const videoButtonElement = await frame.waitForSelector('text="Stop video"');
        await videoButtonElement?.click();

        console.log("Clicking join button.");
        const joinButtonElement = await frame.waitForSelector('text="Join meeting"');
        await joinButtonElement?.click();

        console.log("Opening chat panel.");
        try {
            const chatPanelElement = await frame.waitForSelector(
                'text="Chat"',
                { timeout: details.waiting_timeout }
            );
            await chatPanelElement?.click();
        } catch {
            console.log("Your scribe was not admitted into the meeting.");
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("Sending introduction messages.");
        await this.sendMessages(frame, details.intro_messages);

        await page.exposeFunction("speakerChange", transcriptionService.speakerChange);
        console.log("Listening for speaker changes.")
        await page.evaluate(
            ({ iframe }) => {
                const iFrame = document.querySelector(iframe);
                const iFrameDocument = iFrame?.ownerDocument;
                const targetNode = iFrameDocument?.querySelector('div[class*="layout-layout-content-left"]');

                const config = { attributes: true, subtree: true };

                const callback = (mutationList: MutationRecord[]) => {
                    for (const mutation of mutationList) {
                        if (mutation.attributeName === 'class') {
                            const childNode = mutation.target as HTMLElement;
                            const pattern = /.*videoitem-in-speaking.*/;
                            if (childNode.classList.value.match(pattern)) {
                                (window as any).speakerChange(childNode.textContent);
                            }
                        }
                    }
                };

                const observer = new MutationObserver(callback);
                if (targetNode) observer.observe(targetNode, config);
            },
            { iframe: this.iframe }
        );

        await page.exposeFunction("messageChange", async (sender: string, message: string) => {
            if (!sender?.startsWith("Scribe")) {
                if (message.includes(details.end_command)) {
                    console.log("Your scribe has been removed from the meeting.");
                    await page.goto("about:blank");
                } else if (details.start && message.includes(details.pause_command)) {
                    details.start = false;
                    console.log(details.pause_messages[0]);
                    await this.sendMessages(frame, details.pause_messages);
                } else if (!details.start && message.includes(details.start_command)) {
                    details.start = true;
                    console.log(details.start_messages[0]);
                    await this.sendMessages(frame, details.start_messages);
                } else if (details.start) {
                    details.messages.push(message);
                }
            }
        });
        console.log("Listening for message changes.")
        await page.evaluate(
            ({ iframe }) => {
                const iFrame = document.querySelector(iframe);
                const iFrameDocument = iFrame?.ownerDocument;
                const targetNode = iFrameDocument?.querySelector('div[class^="style-chat-box"]');
                const config = { childList: true, subtree: true };

                const callback = (mutationList: MutationRecord[]) => {
                    const lastMutation = mutationList[mutationList.length - 1];
                    const addedNode = lastMutation.addedNodes[0] as Element;
                    if (addedNode) {
                        const sender = addedNode.querySelector('h3[class^="style-chat-label"]')?.textContent;
                        const message = addedNode.querySelector('span[class^="style-chat-msg"]')?.textContent;
                        if (sender && message) {
                            (window as any).messageChange(sender, message);
                        }
                    }
                };

                const observer = new MutationObserver(callback);
                if (targetNode) observer.observe(targetNode, config);
            },
            { iframe: this.iframe }
        );

        console.log("Waiting for meeting end.");
        try {
            await page.waitForSelector('.style-end-message-2PkYs', {
                timeout: details.meeting_timeout
            });
            console.log("Meeting ended.");
        } catch (error) {
            console.log("Meeting timed out.");
        } finally {
            details.start = false;
        }
    }

}
