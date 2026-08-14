import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

const datasourceUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

const isGenerateCommand =
  process.argv.includes("generate") ||
  process.env.npm_lifecycle_event === "postinstall";

if (!datasourceUrl && !isGenerateCommand) {
  throw new Error(
    "Missing DATABASE_URL or DIRECT_URL. Add your Neon connection strings in Vercel Environment Variables (and .env.local locally).",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      datasourceUrl ??
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  },
});
