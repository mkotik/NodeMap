import { streamText, convertToModelMessages } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openrouter("google/gemini-2.0-flash-001"),
    system:
      "You are Neural Logic, an AI assistant that helps with non-linear thinking and complex problem solving. Be concise and insightful.",
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
