import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.E2_REGION || "us-east-1",
  endpoint: process.env.E2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.E2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.E2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for S3-compatible stores like iDrive E2
});

const BUCKET = process.env.E2_BUCKET!;

/**
 * Generate a presigned PUT URL for upload and a presigned GET URL for reading.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; readUrl: string }> {
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 600 }); // 10 min

  // Presigned GET URL — 7 days so it works for model access and conversation reload
  const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const readUrl = await getSignedUrl(s3, getCommand, { expiresIn: 604800 }); // 7 days

  return { uploadUrl, readUrl };
}
