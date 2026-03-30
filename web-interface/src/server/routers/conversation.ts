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
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, search } = input;

      const where = {
        userId: ctx.user.userId,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                {
                  branches: {
                    some: {
                      isMain: true,
                      messages: {
                        some: {
                          role: "user",
                          content: {
                            contains: search,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: {
            branches: {
              select: {
                id: true,
                isMain: true,
                label: true,
                messages: {
                  where: { role: "user" },
                  orderBy: { orderIndex: "asc" },
                  take: 1,
                  select: { content: true },
                },
              },
            },
            _count: { select: { branches: true } },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      let nextCursor: string | null = null;
      if (conversations.length > limit) {
        conversations.pop(); // discard the extra peek row
        nextCursor = conversations[conversations.length - 1].id;
      }

      const items = conversations.map((c) => {
        const mainBranch = c.branches.find((b) => b.isMain);
        const preview = mainBranch?.messages[0]?.content.slice(0, 120) ?? "";
        return {
          id: c.id,
          title: c.title,
          preview,
          branchCount: c._count.branches,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });

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
      await prisma.message.deleteMany({
        where: { branch: { conversationId: convId } },
      });
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

  // ----- rename a branch -----
  renameBranch: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        branchId: z.string(),
        label: z.string().min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const conv = await prisma.conversation.findFirst({
        where: { id: input.conversationId, userId: ctx.user.userId },
        select: { id: true },
      });
      if (!conv) return { success: false };

      await prisma.branch.updateMany({
        where: { id: input.branchId, conversationId: input.conversationId },
        data: { label: input.label },
      });
      return { success: true };
    }),

  // ----- delete a branch -----
  deleteBranch: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        branchId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and prevent deleting the main branch
      const conv = await prisma.conversation.findFirst({
        where: { id: input.conversationId, userId: ctx.user.userId },
        include: {
          branches: {
            where: { id: input.branchId },
            select: { id: true, isMain: true },
          },
        },
      });
      if (!conv || conv.branches.length === 0 || conv.branches[0].isMain) {
        return { success: false };
      }

      await prisma.message.deleteMany({
        where: { branchId: input.branchId },
      });
      await prisma.branch.deleteMany({
        where: { id: input.branchId, conversationId: input.conversationId },
      });
      return { success: true };
    }),

  // ----- rename a conversation -----
  rename: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.conversation.updateMany({
        where: { id: input.id, userId: ctx.user.userId },
        data: { title: input.title },
      });
      return { success: true };
    }),

  // ----- delete a conversation and return refreshed page -----
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        pageCursor: z.string().nullish(),
        pageLimit: z.number().min(1).max(50).default(10),
        search: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId;

      await prisma.conversation.deleteMany({
        where: { id: input.id, userId },
      });

      // Re-fetch the current page after deletion
      const where = {
        userId,
        ...(input.search
          ? {
              OR: [
                {
                  title: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  branches: {
                    some: {
                      isMain: true,
                      messages: {
                        some: {
                          role: "user",
                          content: {
                            contains: input.search,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: input.pageLimit + 1,
          ...(input.pageCursor
            ? { cursor: { id: input.pageCursor }, skip: 1 }
            : {}),
          include: {
            branches: {
              select: {
                id: true,
                isMain: true,
                label: true,
                messages: {
                  where: { role: "user" },
                  orderBy: { orderIndex: "asc" },
                  take: 1,
                  select: { content: true },
                },
              },
            },
            _count: { select: { branches: true } },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      let nextCursor: string | null = null;
      if (conversations.length > input.pageLimit) {
        conversations.pop();
        nextCursor = conversations[conversations.length - 1].id;
      }

      const items = conversations.map((c) => {
        const mainBranch = c.branches.find((b) => b.isMain);
        const preview = mainBranch?.messages[0]?.content.slice(0, 120) ?? "";
        return {
          id: c.id,
          title: c.title,
          preview,
          branchCount: c._count.branches,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });

      return { items, nextCursor, total };
    }),
});
