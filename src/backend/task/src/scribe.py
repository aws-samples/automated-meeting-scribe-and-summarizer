import asyncio
import details
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
import os

# import wave
# import io
from datetime import datetime, timedelta
import bisect

speaker_timestamps = []

channels = 1
sample_width = 2
frame_rate = 16000


async def create_process():
    process = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-loglevel",
        "warning",
        "-f",
        "pulse",
        "-i",
        "default",
        "-f",
        "s16le",
        "-ar",
        f"{frame_rate}",
        "-ac",
        f"{channels}",
        "-acodec",
        "pcm_s16le",
        "-",
        stdout=asyncio.subprocess.PIPE,
    )
    return process


class ScribeHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        for result in transcript_event.transcript.results:
            if not result.is_partial:
                for item in result.alternatives[0].items:
                    word = item.content
                    word_type = item.item_type
                    if word_type == "pronunciation":
                        timestamp = start_time + timedelta(seconds=item.start_time)
                        label = f"({item.speaker})"
                        speaker = f"{details.speakers[
                            bisect.bisect_right(speaker_timestamps, timestamp) - 1
                        ]}"
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
    chunk_size = 1024
    silent_chunk = b"\x00" * chunk_size

    # buffer = io.BytesIO()
    # wav_file = wave.open("audio_file.wav", "wb")
    # wav_file.setnchannels(channels)
    # wav_file.setsampwidth(sample_width)
    # wav_file.setframerate(frame_rate)

    while process.returncode is None:
        audio_chunk = await process.stdout.read(chunk_size)
        if details.start:
            await stream.input_stream.send_audio_event(audio_chunk=audio_chunk)
            # buffer.write(audio_chunk)
        else:
            await stream.input_stream.send_audio_event(audio_chunk=silent_chunk)

    await stream.input_stream.end_stream()

    # wav_file.writeframes(buffer.getvalue())
    # wav_file.close()


async def transcribe(process):
    global start_time

    stream = await TranscribeStreamingClient(
        region="us-east-1"
    ).start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=frame_rate,
        media_encoding="pcm",
        show_speaker_label=True,
        # vocabulary_name=os.environ["VOCABULARY_NAME"],
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
