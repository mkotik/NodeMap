// @ts-expect-error -- no types for worker bundle
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";

// Make the worker available globally so pdfjs picks it up without spawning a web worker
(globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker;

const RequestSchema = z.object({
  url: z.string().url(),
  mediaType: z.string(),
});

const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
]);

const MAX_EXTRACT_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_TEXT_LENGTH = 100_000; // ~100k chars to avoid overwhelming the model

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    verifyAccessToken(auth.slice(7));
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { url, mediaType } = parsed.data;

  // Images don't need text extraction
  if (mediaType.startsWith("image/")) {
    return Response.json({ text: null });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch file" },
        { status: 502 },
      );
    }

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_EXTRACT_SIZE) {
      return Response.json(
        { error: "File too large for extraction" },
        { status: 400 },
      );
    }

    let text: string;

    if (mediaType === "application/pdf") {
      const arrayBuffer = await res.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false, useSystemFonts: true }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      text = pages.join("\n\n");
    } else if (TEXT_TYPES.has(mediaType)) {
      text = await res.text();
    } else {
      return Response.json({ text: null });
    }

    // Truncate if extremely long
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + "\n\n[Content truncated]";
    }

    return Response.json({ text });
  } catch (err) {
    console.error("Text extraction failed:", err);
    return Response.json(
      { error: "Extraction failed" },
      { status: 500 },
    );
  }
}
