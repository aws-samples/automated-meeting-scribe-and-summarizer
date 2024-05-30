
import scribe
import asyncio
from playwright.async_api import async_playwright

if scribe.meeting_platform == "Chime":
    from chime import initialize
elif scribe.meeting_platform == "Zoom":
    from zoom import initialize

async def meeting():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False, 
            ignore_default_args=['--mute-audio'],
            args=[
                "--window-size=1000,1000",
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
        await browser.close()
        await scribe.deliver()

asyncio.run(meeting())