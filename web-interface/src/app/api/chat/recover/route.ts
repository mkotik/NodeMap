import { generateText } from "ai";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { prisma } from "@/server/lib/prisma";
import { getOpenRouter } from "@/server/lib/openrouter";

const RequestSchema = z.object({
  conversationId: z.string(),
});

export async function POST(req: Request) {
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
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: parsed.data.conversationId, userId },
    include: {
      branches: {
        include: { messages: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });

  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const mainBranch = conversation.branches.find((b) => b.isMain);
  if (!mainBranch || mainBranch.messages.length === 0) {
    return Response.json({ id: conversation.id, recovered: false });
  }

  const messages = mainBranch.messages;
  const lastMessage = messages[messages.length - 1];
  const needsResponse = lastMessage.role === "user";
  const needsTitle = !conversation.title || conversation.title === "Untitled";

  if (!needsResponse && !needsTitle) {
    return Response.json({ id: conversation.id, recovered: false });
  }

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const openrouter = await getOpenRouter(userId);
  if (!openrouter) {
    return Response.json({ id: conversation.id, recovered: false });
  }

  // Generate LLM response if missing
  if (needsResponse) {
    const { text: assistantText } = await generateText({
      model: openrouter("google/gemini-2.0-flash-001"),
      system:
        "You are Neural Logic, an AI assistant that helps with non-linear thinking and complex problem solving. Be concise and insightful.",
      messages: chatMessages,
    });

    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        branchId: mainBranch.id,
        parentMessageId: lastMessage.id,
        role: "assistant",
        content: assistantText,
        orderIndex: messages.length,
      },
    });
  }

  // Generate title if missing — preserve original updatedAt so the chat
  // stays in its original position in recents / history.
  if (needsTitle) {
    const firstUserMsg = chatMessages.find((m) => m.role === "user");
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
        if (name.trim()) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              title: name.trim().slice(0, 40),
              updatedAt: conversation.updatedAt,
            },
          });
        }
      } catch {
        // keep existing title
      }
    }
  }

  return Response.json({ id: conversation.id, recovered: true });
}
