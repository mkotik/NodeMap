import { generateText } from "ai";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { prisma } from "@/server/lib/prisma";
import { getOpenRouter } from "@/server/lib/openrouter";

const RequestSchema = z.object({
  conversationId: z.string().nullable(),
  title: z.string(),
  mainBranchId: z.string(),
  activeBranchId: z.string(),
  branches: z.array(
    z.object({
      id: z.string(),
      parentBranchId: z.string().nullable(),
      forkPointId: z.string().nullable(),
      label: z.string(),
      color: z.string(),
      isMain: z.boolean(),
    }),
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      branchId: z.string(),
      parentMessageId: z.string().nullable(),
      role: z.string(),
      content: z.string(),
      orderIndex: z.number(),
    }),
  ),
  chatMessages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export async function POST(req: Request) {
  // Authenticate
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let userId: string;
  try {
    const payload = verifyAccessToken(auth.slice(7));
    userId = payload.userId;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = parsed.data;
  const openrouter = await getOpenRouter(userId);
  if (!openrouter) {
    return Response.json(
      {
        error: "NO_API_KEY",
        message: "Add your OpenRouter API key in Settings.",
      },
      { status: 403 },
    );
  }

  // Generate LLM response (non-streaming)
  const { text: assistantText } = await generateText({
    model: openrouter("google/gemini-2.0-flash-001"),
    system:
      "You are Neural Logic, an AI assistant that helps with non-linear thinking and complex problem solving. Be concise and insightful.",
    messages: input.chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Generate conversation name if untitled
  let title = input.title;
  if (title === "Untitled") {
    const firstUserMsg = input.chatMessages.find((m) => m.role === "user");
    if (firstUserMsg) {
      try {
        const { text: name } = await generateText({
          model: openrouter("google/gemini-2.0-flash-lite-001"),
          system:
            "Generate a very short label (2-4 words max) for a conversation branch. " +
            "The label should capture the essence of where the conversation is heading. " +
            "Reply with ONLY the label — no quotes, no punctuation, no explanation.",
          prompt: `The user's new direction:\n${firstUserMsg.content}`,
        });
        if (name.trim()) title = name.trim().slice(0, 40);
      } catch {
        // Keep "Untitled" if naming fails
      }
    }
  }

  // Add assistant message to the messages array
  const activeBranchMsgs = input.messages
    .filter((m) => m.branchId === input.activeBranchId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const lastMsg = activeBranchMsgs[activeBranchMsgs.length - 1];

  const assistantMsg = {
    id: crypto.randomUUID(),
    branchId: input.activeBranchId,
    parentMessageId: lastMsg?.id ?? null,
    role: "assistant",
    content: assistantText,
    orderIndex: (lastMsg?.orderIndex ?? -1) + 1,
  };

  const allMessages = [...input.messages, assistantMsg];

  // Save to DB (same full-replace strategy as conversation.save)
  const conversation = input.conversationId
    ? await prisma.conversation.update({
        where: { id: input.conversationId },
        data: { title, updatedAt: new Date() },
      })
    : await prisma.conversation.create({
        data: { userId, title },
      });

  const convId = conversation.id;

  await prisma.message.deleteMany({
    where: { branch: { conversationId: convId } },
  });
  await prisma.branch.deleteMany({ where: { conversationId: convId } });

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

  if (allMessages.length > 0) {
    await prisma.message.createMany({
      data: allMessages.map((m) => ({
        id: m.id,
        branchId: m.branchId,
        parentMessageId: m.parentMessageId,
        role: m.role,
        content: m.content,
        orderIndex: m.orderIndex,
      })),
    });
  }

  return Response.json({ id: convId });
}
