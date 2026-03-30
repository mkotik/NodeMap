import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.record(z.string(), z.unknown())),
    }).passthrough(),
  ),
});

export async function POST(req: Request) {
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
