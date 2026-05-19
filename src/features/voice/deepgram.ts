import { config } from "@/lib/config";
import { decryptText } from "@/lib/encryption";
import { prisma } from "@/lib/db";

export async function resolveDeepgramApiKey(userId: string): Promise<string | null> {
  const savedConfig = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "deepgram",
      },
    },
  });

  if (savedConfig?.apiKey) {
    return decryptText(savedConfig.apiKey, config.encryptionKey);
  }

  return config.deepgramApiKey ?? null;
}