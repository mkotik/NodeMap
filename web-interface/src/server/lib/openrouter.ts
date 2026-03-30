import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

/**
 * Get an OpenRouter provider instance using the user's stored key.
 * Returns null if the user has no key saved.
 */
export async function getOpenRouter(userId?: string) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openRouterKeyEncrypted: true },
  });

  if (!user?.openRouterKeyEncrypted) return null;

  const apiKey = decrypt(user.openRouterKeyEncrypted);
  return createOpenRouter({ apiKey });
}
