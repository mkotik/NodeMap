import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

export default async function globalTeardown() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM "User" WHERE email LIKE '%@nodemap.test'`,
    );
  } finally {
    await client.end();
  }
}
