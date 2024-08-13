import asyncio
import details
import scribe
from playwright.async_api import TimeoutError
from datetime import datetime


async def meeting(page):

    print("Getting meeting link.")
    await page.goto("https://signin.webex.com/join")

    print("Entering meeting ID.")
    meeting_text_element = await page.wait_for_selector("#join-meeting-form")
    await meeting_text_element.type(details.meeting_id)
    await meeting_text_element.press("Enter")

    print("Launching app.")
    await page.wait_for_selector(".meet_message_H1")
    await page.goto(f"{page.url}?launchApp=true")

    frame_element = await page.wait_for_selector("iframe[name='thinIframe']")
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
    await email_text_element.type("scribe@scribe.dev.amazon.com")
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

    async def send_messages(messages):
        message_element = await frame.wait_for_selector(
            'textarea[placeholder="Type your message here"]'
        )
        for message in messages:
            await message_element.type(message)
            await message_element.press("Enter")

    print("Sending introduction messages.")
    await send_messages(details.intro_messages)

    # async def attendee_change(number: int):
    #     if number <= 1:
    #         print("Your scribe got lonely and left.")
    #         await page.goto("about:blank")

    # await page.expose_function("attendeeChange", attendee_change)

    # print("Listening for attendee changes.")
    # await page.evaluate(
    #     """
    #     const targetNode = document.querySelector('button[data-testid="collapse-container"][aria-label^="Present"]')
    #     const config = { characterData: true, subtree: true }

    #     const callback = (mutationList, observer) => {
    #         attendeeChange(parseInt(mutationList[mutationList.length - 1].target.textContent))
    #     }

    #     const observer = new MutationObserver(callback)
    #     observer.observe(targetNode, config)
    # """
    # )

    await page.expose_function("speakerChange", scribe.speaker_change)

    print("Listening for speaker changes.")
    await page.evaluate(
        """
        const iFrame = document.querySelector("iframe[name='thinIframe']")
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
    )

    # async def message_change(sender, text, attachment_title, attachment_href):
    #     global prev_sender
    #     if not sender:
    #         sender = prev_sender
    #     prev_sender = sender
    #     if text == details.end_command:
    #         print("Your scribe has been removed from the meeting.")
    #         await page.goto("about:blank")
    #     elif details.start and text == details.pause_command:
    #         details.start = False
    #         print(details.pause_messages[0])
    #         await send_messages(details.pause_messages)
    #     elif not details.start and text == details.start_command:
    #         details.start = True
    #         print(details.start_messages[0])
    #         await send_messages(details.start_messages)
    #         asyncio.create_task(scribe.transcribe())
    #     elif details.start and not (
    #         sender == "Amazon Chime" or details.scribe_name in sender
    #     ):
    #         timestamp = datetime.now().strftime("%H:%M")
    #         message = f"[{timestamp}] {sender}: "
    #         if attachment_title and attachment_href:
    #             details.attachments[attachment_title] = attachment_href
    #             if text:
    #                 message += f"{text} | {attachment_title}"
    #             else:
    #                 message += attachment_title
    #         else:
    #             message += text
    #         # print('New Message:', message)
    #         details.messages.append(message)

    # await page.expose_function("messageChange", message_change)

    # print("Listening for message changes.")
    # await page.evaluate(
    #     """
    #     const targetNode = document.querySelector('._2B9DdDvc2PdUbvEGXfOU20')
    #     const config = { childList: true, subtree: true }

    #     const callback = (mutationList, observer) => {
    #         for (const mutation of mutationList) {
    #             const addedNode = mutation.addedNodes[0]
    #             if (addedNode) {
    #                 const sender = addedNode.querySelector('h3[data-testid="chat-bubble-sender-name"]')?.textContent
    #                 const text = addedNode.querySelector('.Linkify')?.textContent
    #                 const attachmentElement = addedNode.querySelector('.SLFfm3Dwo5MfFzks4uM11')
    #                 const attachmentTitle = attachmentElement?.title
    #                 const attachmentHref = attachmentElement?.href
    #                 messageChange(sender, text, attachmentTitle, attachmentHref)
    #             }
    #         }
    #     }

    #     const observer = new MutationObserver(callback)
    #     observer.observe(targetNode, config)
    # """
    # )

    print("Waiting for meeting end.")
    try:
        await frame.wait_for_selector(
            ".style-end-message-2PkYs", timeout=details.meeting_timeout
        )
        print("Meeting ended.")
    except TimeoutError:
        print("Meeting timed out.")
    finally:
        details.start = False
