
import asyncio
from playwright.async_api import async_playwright
import scribe
from datetime import datetime

async def initialize(page):

        print("Getting meeting link.")
        await page.goto(f"https://app.chime.aws/meetings/{scribe.meeting_id}")

        print("Entering name.")
        name_text_element = await page.wait_for_selector('#name')
        await name_text_element.type(scribe.scribe_identity)
        await name_text_element.press('Tab')
        await page.keyboard.press('Enter')

        print("Clicking mute button.")
        mute_checkbox_element = await page.wait_for_selector('text="Join muted"')
        await mute_checkbox_element.click()

        print("Clicking join button.")
        join_button_element = await page.wait_for_selector(
            'button[data-testid="button"][aria-label="Join"]'
        )
        await join_button_element.click()

        print("Opening chat panel.")
        chat_panel_element = await page.wait_for_selector(
            'button[data-testid="button"][aria-label^="Open chat panel"]',
            timeout=3000000
        )
        await chat_panel_element.click()

        async def send_message(message):
            message_element = await page.wait_for_selector(
                'textarea[placeholder="Message all attendees"]'
            )
            await message_element.fill(message)
            await message_element.press('Enter')       

        print("Sending introduction messages.")
        for message in scribe.intro_messages:
            await send_message(message)

        print("Opening attendees panel.")
        attendees_panel_element = await page.wait_for_selector(
            'button[data-testid="button"][aria-label^="Open attendees panel"]'
        )
        await attendees_panel_element.click()

        await page.expose_function("speakerChange", scribe.speaker_change)

        await page.evaluate('''
            const targetNode = document.querySelector('.activeSpeakerCell ._3yg3rB2Xb_sfSzRXkm8QT-')
            const config = { characterData: true, subtree: true }

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    speakerChange(mutation.target.textContent)
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        async def message_change(sender, text, attachment_title, attachment_href):
            global prev_sender
            if not sender:
                sender = prev_sender
            prev_sender = sender
            if text == scribe.end_command:
                leave_button_element = await page.wait_for_selector('button[id="endMeeting"]')
                await leave_button_element.click()
            elif scribe.start and text == scribe.pause_command:
                scribe.start = False
                start_message = 'Not saving attendance, new messages or transcriptions.'
                print(start_message)
                await send_message(start_message)
            elif not scribe.start and text == scribe.start_command:
                scribe.start = True
                start_message = 'Saving attendance, new messages and transcriptions.'
                print(start_message)
                await send_message(start_message)
                global transcribe_task
                transcribe_task = asyncio.create_task(scribe.transcribe())
            elif scribe.start and not (sender == "Amazon Chime" or scribe.scribe_name in sender):
                timestamp = datetime.now().strftime('%H:%M')
                message = f"[{timestamp}] {sender}: "
                if attachment_title and attachment_href:
                    scribe.attachments[attachment_title] = attachment_href
                    if text:
                        message += f"{text} | {attachment_title}"
                    else:
                        message += attachment_title
                else:
                    message += text
                print('New Message:', message)
                scribe.messages.append(message)                

        await page.expose_function("messageChange", message_change)
        
        await page.evaluate('''
            const targetNode = document.querySelector('._2B9DdDvc2PdUbvEGXfOU20')
            const config = { childList: true, subtree: true }

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    const addedNode = mutation.addedNodes[0]
                    if (addedNode) {
                        const sender = addedNode.querySelector('h3[data-testid="chat-bubble-sender-name"]')?.textContent
                        const text = addedNode.querySelector('.Linkify')?.textContent
                        const attachmentElement = addedNode.querySelector('.SLFfm3Dwo5MfFzks4uM11')
                        const attachmentTitle = attachmentElement?.title
                        const attachmentHref = attachmentElement?.href
                        messageChange(sender, text, attachmentTitle, attachmentHref)  
                    }
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        async def meeting_end():
            global start
            try:
                await page.wait_for_selector('button[id="endMeeting"]', state="detached", timeout=43200000)
                print("Meeting ended.")
            except TimeoutError:
                print("Meeting timed out.")
            finally:
                scribe.start = False
                # stop audio things
        
        print("Waiting for meeting end.")
        await meeting_end()
