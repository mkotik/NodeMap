import { generateText } from "ai";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { getOpenRouter } from "@/server/lib/openrouter";

const BranchNameRequestSchema = z.object({
  userMessage: z.string().min(1).max(5000),
  priorMessages: z
    .array(
      z.object({
        role: z.string(),
        text: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: Request) {
  // Extract userId if authenticated
  let userId: string | undefined;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(auth.slice(7));
      userId = payload.userId;
    } catch {
      // Continue with env key
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = BranchNameRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { userMessage, priorMessages } = parsed.data;

  let context = "";
  if (priorMessages.length) {
    context =
      "Recent conversation before the branch:\n" +
      priorMessages.map((m) => `${m.role}: ${m.text}`).join("\n") +
      "\n\n";
  }

  const openrouter = await getOpenRouter(userId);
  if (!openrouter) {
    return Response.json({ name: "" });
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
