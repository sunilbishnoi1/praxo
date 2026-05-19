export type WhisperTranscriptionResult = {
  transcript: string;
  provider: "whisper";
  confidence: number;
};

export async function transcribeWithWhisper(
  audio: Blob,
  fallbackTranscript = ""
): Promise<WhisperTranscriptionResult> {
  void audio;

  return {
    transcript: fallbackTranscript,
    confidence: fallbackTranscript.trim().length > 0 ? 0.4 : 0,
    provider: "whisper",
  };
}
