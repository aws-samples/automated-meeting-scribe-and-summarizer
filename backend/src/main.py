
import asyncio
import zoom
import scribe

asyncio.run(zoom.initialize())
scribe.deliver()
