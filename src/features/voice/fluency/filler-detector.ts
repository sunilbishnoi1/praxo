const DEFAULT_FILLER_WORDS = [
  "um",
  "uh",
  "uhh",
  "umm",
  "like",
  "you know",
  "actually",
  "basically",
  "sort of",
  "kind of",
];

export type FillerMatch = {
  word: string;
  count: number;
};

export function normalizeFillerWords(value?: string | null): string[] {
  if (!value) {
    return DEFAULT_FILLER_WORDS;
  }

  const overrides = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return overrides.length > 0 ? overrides : DEFAULT_FILLER_WORDS;
}

export function detectFillers(
  transcript: string,
  fillerList: string[] = DEFAULT_FILLER_WORDS
): FillerMatch[] {
  const normalized = transcript.toLowerCase();

  return fillerList
    .map((filler) => {
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = normalized.match(new RegExp(`\\b${escaped}\\b`, "g"));
      return {
        word: filler,
        count: matches?.length ?? 0,
      };
    })
    .filter((match) => match.count > 0);
}
