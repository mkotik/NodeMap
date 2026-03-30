import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { userMessage, priorMessages } = await req.json();

  let context = "";
  if (priorMessages?.length) {
    context =
      "Recent conversation before the branch:\n" +
      priorMessages
        .map((m: { role: string; text: string }) => `${m.role}: ${m.text}`)
        .join("\n") +
      "\n\n";
  }

  const { text } = await generateText({
    model: openrouter("google/gemini-2.0-flash-lite-001"),
    system:
      "Generate a very short label (2-4 words max) for a conversation branch. " +
      "The label should capture the essence of where the conversation is heading. " +
      "Reply with ONLY the label — no quotes, no punctuation, no explanation.",
    prompt: `${context}The user's new direction:\n${userMessage}`,
  });

  return Response.json({ name: text.trim().slice(0, 40) });
}
