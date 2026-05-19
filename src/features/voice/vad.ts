export type VadFrame = {
  level: number;
  timestamp: number;
};

export type VadConfig = {
  silenceThresholdMs: number;
  levelThreshold: number;
  minSpeechFrames: number;
};

export function createDefaultVadConfig(): VadConfig {
  return {
    silenceThresholdMs: 2000,
    levelThreshold: 0.02,
    minSpeechFrames: 3,
  };
}

export function isSpeaking(level: number, threshold = 0.02): boolean {
  return level >= threshold;
}

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let total = 0;
  for (const sample of samples) {
    total += sample * sample;
  }

  return Math.sqrt(total / samples.length);
}

export function dbFromRms(rms: number): number {
  if (rms <= 0) {
    return -120;
  }

  return 20 * Math.log10(rms);
}

export function shouldTriggerSilence(
  lastSpeechAt: number,
  now: number,
  silenceThresholdMs: number
): boolean {
  return now - lastSpeechAt >= silenceThresholdMs;
}
