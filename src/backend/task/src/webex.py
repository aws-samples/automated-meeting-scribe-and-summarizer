import details
import scribe
from playwright.async_api import TimeoutError
from time import sleep


async def meeting(page):
    iframe = 'iframe[name="thinIframe"]'

    print("Getting meeting link.")
    await page.goto("https://signin.webex.com/join")

    print("Entering meeting ID.")
    meeting_text_element = await page.wait_for_selector("#join-meeting-form")
    await meeting_text_element.type(details.meeting_id)
    await meeting_text_element.press("Enter")

    print("Launching app.")
    try:
        await page.wait_for_selector(".meet_message_H1")
    except TimeoutError:
        print("Your scribe was unable to join the meeting.")
        return
    else:
        await page.goto(f"{page.url}?launchApp=true")

    frame_element = await page.wait_for_selector(iframe)
    frame = await frame_element.content_frame()

    print("Entering name.")
    name_text_element = await frame.wait_for_selector(
        'input[aria-labelledby="nameLabel"]'
    )
    await name_text_element.type(details.scribe_identity)

    print("Entering email.")
    email_text_element = await frame.wait_for_selector(
        'input[aria-labelledby="emailLabel"]'
    )
    # await email_text_element.type(details.email_sender)
    await email_text_element.type("bot@scribe.tools.aws.dev")
    await email_text_element.press("Enter")

    print("Clicking cookie button.")
    cookie_button_element = await page.wait_for_selector(".cookie-manage-close-handler")
    await cookie_button_element.click()

    print("Clicking mute button.")
    mute_button_element = await frame.wait_for_selector('text="Mute"')
    await mute_button_element.click()

    print("Clicking video button.")
    video_button_element = await frame.wait_for_selector('text="Stop video"')
    await video_button_element.click()

    print("Clicking join button.")
    join_button_element = await frame.wait_for_selector('text="Join meeting"')
    await join_button_element.click()

    print("Opening chat panel.")
    try:
        chat_panel_element = await frame.wait_for_selector(
            'text="Chat"',
            timeout=details.waiting_timeout,
        )
    except TimeoutError:
        print("Your scribe was not admitted into the meeting.")
        return
    else:
        await chat_panel_element.click()

    sleep(1)

    async def send_messages(messages):
        message_element = await frame.wait_for_selector(
            'textarea[placeholder="Type your message here"]'
        )
        for message in messages:
            await message_element.type(message)
            await message_element.press("Enter")

    print("Sending introduction messages.")
    await send_messages(details.intro_messages)

    await page.expose_function("speakerChange", scribe.speaker_change)

    print("Listening for speaker changes.")
    await page.evaluate(
        """
        const iFrame = document.querySelector('%s')
        const iFrameDocument = iFrame.contentDocument
        const targetNode = iFrameDocument.querySelector('div[class*="layout-layout-content-left"]')

        const config = { attributes: true, subtree: true };

        const callback = (mutationList, observer) => {
            for (const mutation of mutationList) {
                if (mutation.attributeName === 'class') {
                    const childNode = mutation.target;
                    const pattern = /.*videoitem-in-speaking.*/;
                    if (childNode.classList.value.match(pattern)) {
                        speakerChange(childNode.textContent);
                    }
                }
            }
        }

        const observer = new MutationObserver(callback)
        observer.observe(targetNode, config)
    """
        % iframe
    )

    async def message_change(message):
        # print('New Message:', message)
        if details.end_command in message:
            print("Your scribe has been removed from the meeting.")
            await page.goto("about:blank")
        elif details.start and details.pause_command in message:
            details.start = False
            print(details.pause_messages[0])
            await send_messages(details.pause_messages)
        elif not details.start and details.start_command in message:
            details.start = True
            print(details.start_messages[0])
            await send_messages(details.start_messages)
        elif details.start:
            details.messages.append(message)

    await page.expose_function("messageChange", message_change)

    print("Listening for message changes.")
    await page.evaluate(
        """
        const iFrame = document.querySelector('%s')
        const iFrameDocument = iFrame.contentDocument
        const targetNode = iFrameDocument.querySelector('div[class^="style-chat-box"]')
        
        const config = { childList: true, subtree: true }

        const callback = (mutationList, observer) => {
            const addedNode = mutationList[mutationList.length - 1].addedNodes[0]
            if (addedNode) {
                sender = addedNode.querySelector('h3[class^="style-chat-label"]').textContent
                message = addedNode.querySelector('span[class^="style-chat-msg"]').textContent
                if (!sender.startsWith("from Scribe")) {
                    messageChange(message)
                }
            }
        }

        const observer = new MutationObserver(callback)
        observer.observe(targetNode, config)
    """
        % iframe
    )

    print("Waiting for meeting end.")
    try:
        await frame.wait_for_selector(
            ".style-end-message-2PkYs", timeout=details.meeting_timeout
        )
        print("Meeting ended.")
    except:
        print("Meeting timed out.")
    finally:
        details.start = False
