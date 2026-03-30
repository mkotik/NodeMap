import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { getOpenRouter } from "@/server/lib/openrouter";

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

  const modelMessages = await convertToModelMessages(
    parsed.data.messages as unknown as UIMessage[],
  );

  const result = streamText({
    model: openrouter("google/gemini-2.0-flash-001"),
    system:
      "You are Neural Logic, an AI assistant that helps with non-linear thinking and complex problem solving. Be concise and insightful.",
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
