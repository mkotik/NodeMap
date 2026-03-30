import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "../lib/prisma";
import { encrypt, decrypt } from "../lib/crypto";

export const settingsRouter = router({
  getApiKey: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: { openRouterKeyEncrypted: true },
    });
    if (!user?.openRouterKeyEncrypted) return { hasKey: false, maskedKey: null };

    const key = decrypt(user.openRouterKeyEncrypted);
    // Return masked version: show first 8 and last 4 chars
    const masked =
      key.length > 12
        ? key.slice(0, 8) + "..." + key.slice(-4)
        : "***";
    return { hasKey: true, maskedKey: masked };
  }),

  saveApiKey: protectedProcedure
    .input(z.object({ apiKey: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const encrypted = encrypt(input.apiKey);
      await prisma.user.update({
        where: { id: ctx.user.userId },
        data: { openRouterKeyEncrypted: encrypted },
      });
      return { success: true };
    }),

  removeApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.update({
      where: { id: ctx.user.userId },
      data: { openRouterKeyEncrypted: null },
    });
    return { success: true };
  }),
});
