
import asyncio
import details
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
import sounddevice as sd
from datetime import datetime, timedelta
import bisect

speaker_timestamps = []

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        for result in transcript_event.transcript.results:
            if not result.is_partial:
                for item in result.alternatives[0].items:
                    word = item.content
                    word_type = item.item_type
                    if word_type == "pronunciation":
                        timestamp = start_time + timedelta(seconds=item.start_time)
                        speaker = details.speakers[
                            bisect.bisect_right(speaker_timestamps, timestamp) - 1
                        ]
                        # print(f"[{timestamp.strftime('%H:%M:%S.%f')}] {speaker}: {word}")
                        if not details.captions or speaker not in details.captions[-1].split(': ')[0]:
                            details.captions.append(
                                f"[{timestamp.strftime('%H:%M')}] {speaker}: {word}"
                            )
                        else:
                            details.captions[-1] += f" {word}"
                    elif word_type == "punctuation":
                        details.captions[-1] += word

async def write_audio(stream):
    loop = asyncio.get_event_loop()
    input_queue = asyncio.Queue()

    def callback(indata, frame_count, time_info, status):
        loop.call_soon_threadsafe(input_queue.put_nowait, (bytes(indata), status))

    with sd.RawInputStream(
        channels=1,
        samplerate=16000,
        callback=callback,
        blocksize=1024 * 2,
        dtype='int16'
    ):
        while details.start:
            indata, status = await input_queue.get()
            await stream.input_stream.send_audio_event(audio_chunk=indata)
        
        await stream.input_stream.end_stream()

async def transcribe():
    global start_time
    start_time = datetime.now()

    stream = await TranscribeStreamingClient(region="us-east-1").start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    await asyncio.gather(
        write_audio(stream), 
        MyEventHandler(stream.output_stream).handle_events()
    )      

async def speaker_change(speaker):
    timestamp = datetime.now() - timedelta(seconds=.5)
    speaker_timestamps.append(timestamp)
    details.speakers.append(speaker)
    # print(f"[{timestamp.strftime('%H:%M:%S.%f')}] {speaker}")
