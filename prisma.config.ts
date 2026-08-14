import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DIRECT_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  },
});
