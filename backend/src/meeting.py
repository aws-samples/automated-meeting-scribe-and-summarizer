
import scribe
import asyncio
from playwright.async_api import async_playwright
import sys

if scribe.meeting_platform == "Chime":
    from chime import initialize, deinitialize
elif scribe.meeting_platform == "Zoom":
    from zoom import initialize, deinitialize

async def meeting():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, 
            ignore_default_args=['--mute-audio'],
            args=[
                "--window-size=1920,1080",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--disable-notifications",
                "--disable-extensions",
                "--disable-crash-reporter",
                "--disable-dev-shm-usage",
                "--no-sandbox"
            ]
        )
        page = await browser.new_page()
        page.set_default_timeout(20000)

        await initialize(page)

        print("Waiting for meeting end.")
        await deinitialize(page)
        await browser.close()

asyncio.run(meeting())
scribe.deliver()
sys.exit
