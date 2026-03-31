import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { getOpenRouter } from "@/server/lib/openrouter";
import { prisma } from "@/server/lib/prisma";

const ChatRequestSchema = z.object({
  messages: z.array(
    z
      .object({
        id: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.record(z.string(), z.unknown())),
      })
      .passthrough(),
  ),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json(
      {
        error: "NO_API_KEY",
        message:
          "Sign in and add your OpenRouter API key in Settings to start chatting.",
      },
      { status: 403 },
    );
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(auth.slice(7));
    userId = payload.userId;
  } catch {
    return Response.json(
      {
        error: "NO_API_KEY",
        message:
          "Sign in and add your OpenRouter API key in Settings to start chatting.",
      },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (user && !user.emailVerified) {
    return Response.json(
      {
        error: "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email address before chatting. Check your inbox for a verification link.",
      },
      { status: 403 },
    );
  }

  const openrouter = await getOpenRouter(userId);
  if (!openrouter) {
    return Response.json(
      {
        error: "NO_API_KEY",
        message: "Add your OpenRouter API key in Settings to start chatting.",
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const selectedModel = parsed.data.model || "google/gemini-2.0-flash-001";

  const modelMessages = await convertToModelMessages(
    parsed.data.messages as unknown as UIMessage[],
  );

  const result = streamText({
    model: openrouter(selectedModel),
    system:
      "You are a helpful AI assistant. Be concise and insightful.",
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
