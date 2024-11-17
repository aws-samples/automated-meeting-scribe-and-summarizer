from details import meeting_platform
from scribe import create_process, transcribe
from process import encapsulate
import asyncio
from playwright.async_api import async_playwright
import sys

if meeting_platform == "Chime":
    from chime import meeting
if meeting_platform == "Webex":
    from webex import meeting


async def app():
    process = await create_process()
    transcribe_task = asyncio.create_task(transcribe(process))

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            ignore_default_args=["--mute-audio"],
            args=[
                "--window-size=1920,1080",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--disable-notifications",
                "--disable-extensions",
                "--disable-crash-reporter",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )
        page = await browser.new_page()
        page.set_default_timeout(20000)
        await meeting(page)
        await browser.close()

    process.terminate()
    await transcribe_task
    encapsulate()


asyncio.run(app())
sys.exit
