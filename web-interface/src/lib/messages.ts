import type { UIMessage } from "ai";

/**
 * Extract the concatenated text content from a message's parts.
 */
export function getMessageText(
  msg:
    | Pick<UIMessage, "parts">
    | { parts: Array<{ type: string; text?: string }> },
): string {
  return msg.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

/**
 * Return a display label for a message based on its role and position.
 */
export function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Neural Logic";
  return index === 0 ? "User Request" : "Follow Up";
}
