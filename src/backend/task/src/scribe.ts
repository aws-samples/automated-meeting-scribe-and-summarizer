
import {
    TranscribeStreamingClient,
    StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { spawn } from 'child_process';
import { details } from './details';

export class TranscriptionService {
    private process: any;
    private readonly startTime = Math.floor(Date.now() / 1000);
    private readonly frameRate = 16000;
    private readonly channels = 1;
    private readonly chunkSize = 1024;

    private async * audioStream() {
        this.process = spawn('ffmpeg', [
            '-loglevel', 'warning',
            '-f', 'pulse',
            '-i', 'default',
            // '-f', 'avfoundation',
            // '-i', ':0',
            '-acodec', 'pcm_s16le',
            '-ac', String(this.channels),
            '-ar', String(this.frameRate),
            '-f', 's16le',
            '-blocksize', String(this.chunkSize),
            '-'
        ]);

        try {
            for await (const chunk of this.process.stdout) {
                if (!details.start) {
                    yield { AudioEvent: { AudioChunk: Buffer.alloc(this.chunkSize) } };
                } else {
                    yield { AudioEvent: { AudioChunk: chunk } };
                }
            }
        } catch (error) {
            console.log('Process error:', error);
        }
    }

    private formatTimestamp(timestamp: number): string {
        const dateTime = new Date(timestamp * 1000);
        return dateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    async startTranscription() {
        const client = new TranscribeStreamingClient({});
        const command = new StartStreamTranscriptionCommand({
            LanguageCode: 'en-US',
            // IdentifyLanguage: true,
            // LanguageOptions: 'en-US,es-US',
            // IdentifyMultipleLanguages: true,
            MediaSampleRateHertz: this.frameRate,
            MediaEncoding: 'pcm',
            ShowSpeakerLabel: true,
            AudioStream: this.audioStream()
        });
        const response = await client.send(command);

        for await (const event of response.TranscriptResultStream ?? []) {
            const results = event.TranscriptEvent?.Transcript?.Results ?? [];
            for (const result of results ?? []) {
                if (result.IsPartial === false) {
                    for (const item of result.Alternatives?.[0]?.Items ?? []) {
                        const word = item.Content
                        const wordType = item.Type
                        if (wordType === 'pronunciation') {
                            const timestamp = this.startTime + item.StartTime!
                            const label = `(${item.Speaker})`
                            const speaker = details.speakers.find(s => s.timestamp <= timestamp)?.name ?? "No one";
                            // console.log(`[${this.formatTimestamp(timestamp)}] ${speaker}: ${word}`)
                            if (
                                details.captions.length === 0 ||
                                !details.captions[details.captions.length - 1].split(": ")[0].includes(speaker)
                            ) {
                                details.captions.push(
                                    `[${this.formatTimestamp(timestamp)}] ${speaker}: ${word}`
                                );
                            } else {
                                details.captions[details.captions.length - 1] += ` ${word}`;
                            }
                        } else if (wordType === "punctuation") {
                            details.captions[details.captions.length - 1] += word;
                        }
                    }
                }
            }
        }
    }

    async stopTranscription() {
        if (this.process) {
            this.process.kill();
        }
    }

    speakerChange = async (speaker: string) => {
        const timestamp = Math.floor(Date.now() / 1000);
        details.speakers.push({ name: speaker, timestamp });
        // console.log(`[${this.formatTimestamp(timestamp)}] ${speaker}`)
    }

}

export const transcriptionService = new TranscriptionService();
