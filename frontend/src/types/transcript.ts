/** Saved transcription config (SQLite transcript_settings via api_*_transcript_config). */
export interface TranscriptModelProps {
  provider: 'localWhisper' | 'parakeet' | 'shenava' | 'deepgram' | 'elevenLabs' | 'groq' | 'openai';
  model: string;
  apiKey?: string | null;
}
