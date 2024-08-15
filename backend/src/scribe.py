import asyncio
import details
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
from datetime import datetime, timedelta
import bisect

speaker_timestamps = []


class ScribeHandler(TranscriptResultStreamHandler):
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
                        if (
                            not details.captions
                            or speaker not in details.captions[-1].split(": ")[0]
                        ):
                            details.captions.append(
                                f"[{timestamp.strftime('%H:%M')}] {speaker}: {word}"
                            )
                        else:
                            details.captions[-1] += f" {word}"
                    elif word_type == "punctuation":
                        details.captions[-1] += word


async def write_audio(process, stream):
    while details.start:
        audio_data = await process.stdout.read(1024)
        await stream.input_stream.send_audio_event(audio_chunk=audio_data)

    await stream.input_stream.end_stream()
    process.terminate()


async def transcribe():
    global start_time

    process = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-f",
        "pulse",
        "-i",
        "default",
        "-f",
        "s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-acodec",
        "pcm_s16le",
        "-",
        stdout=asyncio.subprocess.PIPE,
    )
    stream = await TranscribeStreamingClient(
        region="us-east-1"
    ).start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    start_time = datetime.now()

    await asyncio.gather(
        write_audio(process, stream),
        ScribeHandler(stream.output_stream).handle_events(),
    )


async def speaker_change(speaker):
    timestamp = datetime.now()
    speaker_timestamps.append(timestamp)
    details.speakers.append(speaker)
    # print(f"[{timestamp.strftime('%H:%M:%S.%f')}] {speaker}")
