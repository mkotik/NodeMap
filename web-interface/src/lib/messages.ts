import type { UIMessage } from "ai";

export interface Attachment {
  url: string;
  filename: string;
  mediaType: string;
  size: number;
}

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function isImageType(mediaType: string): boolean {
  return IMAGE_TYPES.has(mediaType);
}

/** Types the model can consume directly as file parts (no text extraction needed). */
const NATIVE_FILE_TYPES = new Set([
  ...IMAGE_TYPES,
  "application/pdf",
]);

export function isNativeFileType(mediaType: string): boolean {
  return NATIVE_FILE_TYPES.has(mediaType);
}

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
 * Extract file attachments from a message's parts.
 */
export function getMessageAttachments(
  msg: Pick<UIMessage, "parts">,
): Attachment[] {
  return msg.parts
    .filter(
      (part): part is { type: "file"; url: string; mediaType: string; filename?: string } =>
        part.type === "file",
    )
    .map((part) => ({
      url: part.url,
      filename: part.filename || "file",
      mediaType: part.mediaType,
      size: 0,
    }));
}

/**
 * Return a display label for a message based on its role and position.
 */
export function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Assistant";
  return "You";
}
