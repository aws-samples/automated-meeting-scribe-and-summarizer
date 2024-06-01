
import asyncio
import scribe

async def initialize(page):

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
            timeout=scribe.waiting_timeout
        )
        await audio_button_element.click()

        print("Opening chat panel.")
        chat_button_element = await page.wait_for_selector(
            'button[aria-label^="open the chat panel"]'
        )
        await chat_button_element.hover()
        await chat_button_element.click()

        async def send_messages(messages):
            message_element = await page.wait_for_selector(
                'div[aria-placeholder="Type message here..."]'
            )
            for message in messages:
                await message_element.fill(message)
                await message_element.press('Enter')   

        print("Sending introduction messages.")
        await send_messages(scribe.intro_messages)

        async def attendee_change(number: int):
            if number <= 1:
                print("Your scribe got lonely and left.")
                await page.goto("about:blank")

        await page.expose_function("attendeeChange", attendee_change)

        print("Listening for attendee changes.")
        await page.evaluate('''
            const targetNode = document.querySelector('.footer-button__number-counter')
            const config = { characterData: true, subtree: true }

            const callback = (mutationList, observer) => {
                attendeeChange(parseInt(mutationList[mutationList.length - 1].target.textContent))
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

        await page.expose_function("speakerChange", scribe.speaker_change)

        print("Listening for speaker changes.")
        await page.evaluate('''
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
            # print('New Message:', message)
            if scribe.end_command in message:
                print("Your scribe has been removed from the meeting.")
                await page.goto("about:blank")
            elif scribe.start and scribe.pause_command in message:
                scribe.start = False
                print(scribe.pause_messages[0])
                await send_messages(scribe.pause_messages)
            elif not scribe.start and scribe.start_command in message:
                scribe.start = True
                print(scribe.start_messages[0])
                await send_messages(scribe.start_messages)
                asyncio.create_task(scribe.transcribe())
            elif scribe.start:
                scribe.messages.append(message)   

        await page.expose_function("messageChange", message_change)
        
        print("Listening for message changes.")
        await page.evaluate('''
            const targetNode = document.querySelector('div[aria-label="Chat Message List"]')
            const config = { childList: true, subtree: true }

            const callback = (mutationList, observer) => {
                const addedNode = mutationList[mutationList.length - 1].addedNodes[0]
                if (addedNode) {
                    message = addedNode.querySelector('div[id^="chat-message-content"]')?.getAttribute('aria-label')
                    if (message && !message.startsWith("You to Everyone")) {
                        messageChange(message)
                    }
                }
            }

            const observer = new MutationObserver(callback)
            observer.observe(targetNode, config)
        ''')

async def deinitialize(page):
    try:
        done, pending = await asyncio.wait(
            fs=[
                asyncio.create_task(page.wait_for_selector('button[aria-label="Leave"]', state="detached", timeout=0)),
                asyncio.create_task(page.wait_for_selector('div[class="zm-modal zm-modal-legacy"]', timeout=0))
            ],
            return_when=asyncio.FIRST_COMPLETED,
            timeout=scribe.meeting_timeout
        )
        [task.cancel() for task in pending]
        print("Meeting ended.")
    except:
        print("Meeting timed out.")
    finally:
        scribe.start = False
