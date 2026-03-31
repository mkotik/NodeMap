import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

/** Mark a test user as email-verified directly in the DB. */
export async function verifyTestUser(email: string) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE "User" SET "emailVerified" = true, "emailVerificationToken" = NULL WHERE email = $1`,
      [email],
    );
  } finally {
    await client.end();
  }
}
