import { z } from "zod";
import { verifyAccessToken } from "@/server/lib/jwt";
import { getPresignedUploadUrl } from "@/server/lib/e2";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 MB

const RequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  size: z.number().positive(),
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
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { filename, contentType, size } = parsed.data;

  // Validate file type
  const isImage = ALLOWED_IMAGE_TYPES.has(contentType);
  const isDoc = ALLOWED_DOC_TYPES.has(contentType);
  if (!isImage && !isDoc) {
    return Response.json(
      { error: "Unsupported file type", message: `${contentType} is not supported.` },
      { status: 400 },
    );
  }

  // Validate file size
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
  if (size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return Response.json(
      { error: "File too large", message: `Max ${limitMB}MB for ${isImage ? "images" : "documents"}.` },
      { status: 400 },
    );
  }

  // Generate unique key
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${userId}/${Date.now()}-${sanitized}`;

  const { uploadUrl, readUrl } = await getPresignedUploadUrl(key, contentType);

  return Response.json({ uploadUrl, readUrl, key });
}
