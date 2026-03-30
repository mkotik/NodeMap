import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "../lib/prisma";

const branchSchema = z.object({
  id: z.string(),
  parentBranchId: z.string().nullable(),
  forkPointId: z.string().nullable(),
  label: z.string(),
  color: z.string(),
  isMain: z.boolean(),
});

const messageSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  parentMessageId: z.string().nullable(),
  role: z.string(),
  content: z.string(),
  orderIndex: z.number(),
});

export const conversationRouter = router({
  // ----- list all conversations for the current user -----
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where: { userId: ctx.user.userId },
          orderBy: { updatedAt: "desc" },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: {
            branches: {
              select: { id: true, isMain: true, label: true },
            },
            _count: { select: { branches: true } },
          },
        }),
        prisma.conversation.count({ where: { userId: ctx.user.userId } }),
      ]);

      let nextCursor: string | null = null;
      if (conversations.length > limit) {
        conversations.pop(); // discard the extra peek row
        nextCursor = conversations[conversations.length - 1].id;
      }

      // Build preview: first user message from the main branch
      const items = await Promise.all(
        conversations.map(async (c) => {
          const mainBranch = c.branches.find((b) => b.isMain);
          let preview = "";
          if (mainBranch) {
            const firstMsg = await prisma.message.findFirst({
              where: { branchId: mainBranch.id, role: "user" },
              orderBy: { orderIndex: "asc" },
              select: { content: true },
            });
            if (firstMsg) preview = firstMsg.content.slice(0, 120);
          }
          return {
            id: c.id,
            title: c.title,
            preview,
            branchCount: c._count.branches,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          };
        }),
      );

      return { items, nextCursor, total };
    }),

  // ----- get a full conversation (branches + messages) -----
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conversation = await prisma.conversation.findFirst({
        where: { id: input.id, userId: ctx.user.userId },
        include: {
          branches: {
            include: {
              messages: { orderBy: { orderIndex: "asc" } },
            },
          },
        },
      });
      if (!conversation) return null;
      return conversation;
    }),

  // ----- save (create or update) a full conversation -----
  save: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        mainBranchId: z.string(),
        branches: z.array(branchSchema),
        messages: z.array(messageSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId;

      // Upsert conversation
      const conversation = input.id
        ? await prisma.conversation.update({
            where: { id: input.id },
            data: { title: input.title, updatedAt: new Date() },
          })
        : await prisma.conversation.create({
            data: { userId, title: input.title },
          });

      const convId = conversation.id;

      // Delete old data and reinsert (simple full-replace strategy)
      await prisma.message.deleteMany({ where: { branch: { conversationId: convId } } });
      await prisma.branch.deleteMany({ where: { conversationId: convId } });

      // Insert branches
      if (input.branches.length > 0) {
        await prisma.branch.createMany({
          data: input.branches.map((b) => ({
            id: b.id,
            conversationId: convId,
            parentBranchId: b.parentBranchId,
            forkPointId: b.forkPointId,
            label: b.label,
            color: b.color,
            isMain: b.isMain,
          })),
        });
      }

      // Insert messages
      if (input.messages.length > 0) {
        await prisma.message.createMany({
          data: input.messages.map((m) => ({
            id: m.id,
            branchId: m.branchId,
            parentMessageId: m.parentMessageId,
            role: m.role,
            content: m.content,
            orderIndex: m.orderIndex,
          })),
        });
      }

      return { id: convId };
    }),

  // ----- delete a conversation -----
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.conversation.deleteMany({
        where: { id: input.id, userId: ctx.user.userId },
      });
      return { success: true };
    }),
});
