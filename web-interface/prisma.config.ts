import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrate: {
    adapter: async () => {
      const pg = await import("pg");
      return new (await import("@prisma/adapter-pg")).PrismaPg({
        connectionString: env("DATABASE_URL"),
      });
    },
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
