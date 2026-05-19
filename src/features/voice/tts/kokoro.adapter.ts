export type KokoroTtsResult = {
  audio: ArrayBuffer | null;
  mimeType: string | null;
};

export async function synthesizeWithKokoro(
  text: string,
  voice?: string | null
): Promise<KokoroTtsResult> {
  void text;
  void voice;

  return {
    audio: null,
    mimeType: null,
  };
}
