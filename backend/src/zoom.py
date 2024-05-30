
import asyncio
from playwright.async_api import async_playwright
import scribe

async def send_message(message):
    message_element = await page.wait_for_selector(
        'div[aria-placeholder="Type message here..."]'
    )
    await message_element.fill(message)
    await message_element.press('Enter')   

async def initialize():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, 
            ignore_default_args=['--mute-audio'],
            args=[
                "--window-size=1000,1000",
                "--use-fake-ui-for-media-stream",
                "--disable-notifications",
                "--disable-extensions",
                "--disable-crash-reporter",
                "--disable-dev-shm-usage",
                "--no-sandbox"
            ]
        )
        global page
        page = await browser.new_page()
        page.set_default_timeout(20000)

        print("Getting meeting link.")
        await page.goto(f"https://zoom.us/wc/{scribe.meeting_id}/join")

        print("Typing meeting password.")
        password_text_element = await page.wait_for_selector('#input-for-pwd')
        await password_text_element.type(scribe.meeting_password)

        print("Entering name.")
        name_text_element = await page.wait_for_selector('#input-for-name')
        await name_text_element.type(scribe.scribe_identity)
        await name_text_element.press("Enter")

        print("Adding audio.")
        audio_button_element = await page.wait_for_selector(
            "text=Join Audio by Computer",
            timeout=3000000
        )
        await audio_button_element.click()

        print("Opening chat panel.")
        chat_button_element = await page.wait_for_selector(
            'button[aria-label^="open the chat panel"]'
        )
        await chat_button_element.hover()
        await chat_button_element.click()

        print("Sending introduction messages.")
        for message in scribe.intro_messages:
            await send_message(message)

        await page.expose_function("speakerChange", scribe.speaker_change)

        await page.evaluate('''
            console.log("Hello there")
            const targetNode = document.querySelector(
                '.speaker-active-container__video-frame .video-avatar__avatar .video-avatar__avatar-title'
            )
            const config = { childList: true, subtree: true }

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    const speaker = mutation.target.textContent
                    if (speaker) {
                        speakerChange(speaker)
                    }
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        async def message_change(message):
            print('New Message:', message)
            if scribe.end_command in message:
                await page.goto("about:blank")
            elif scribe.start and scribe.pause_command in message:
                scribe.start = False
                pause_message = 'Not saving attendance, new messages or machine-generated captions.'
                print(pause_message)
                await send_message(pause_message)
            elif not scribe.start and scribe.start_command in message:
                scribe.start = True
                start_message = 'Saving attendance, new messages and machine-generated captions.'
                print(start_message)
                await send_message(start_message)
                global transcribe_task
                transcribe_task = asyncio.create_task(scribe.transcribe())
            elif scribe.start:
                scribe.messages.append(message)   

        await page.expose_function("messageChange", message_change)
        
        await page.evaluate('''
            const targetNode = document.querySelector('div[aria-label="Chat Message List"]')
            const config = { childList: true, subtree: true }

            const callback = (mutationList, observer) => {
                for (const mutation of mutationList) {
                    const addedNode = mutation.addedNodes[0]
                    if (addedNode) {
                        messageChange(
                            addedNode.querySelector('div[id^="chat-message-content"]').getAttribute('aria-label')
                        )  
                    }
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        async def meeting_end():
            try:
                done, pending = await asyncio.wait(
                    fs=[
                        asyncio.create_task(page.wait_for_selector('button[aria-label="Leave"]', state="detached", timeout=0)),
                        asyncio.create_task(page.wait_for_selector('div[class="zm-modal zm-modal-legacy"]', timeout=0))
                    ],
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=43200000
                )
                [task.cancel() for task in pending]
                print("Meeting ended.")
            except:
                print("Meeting timed out or something.")
            finally:
                scribe.start = False
        
        print("Waiting for meeting end.")
        await meeting_end()
        await browser.close()
