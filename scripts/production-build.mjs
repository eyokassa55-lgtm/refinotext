import { spawnSync } from "node:child_process";

function cleanEnv(value) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const code = result.status ?? 1;
  if (code !== 0 && !allowFailure) {
    process.exit(code);
  }
  return code;
}

run(["prisma", "generate"]);

const databaseUrl =
  cleanEnv(process.env.DIRECT_URL) || cleanEnv(process.env.DATABASE_URL);
const canMigrate =
  Boolean(databaseUrl) &&
  !databaseUrl.includes("127.0.0.1") &&
  !databaseUrl.includes("user:password@localhost");

if (!canMigrate) {
  console.warn(
    "[build] DATABASE_URL/DIRECT_URL not available at build time. Skipping migrations.",
  );
} else {
  const migrateCode = run(["prisma", "migrate", "deploy"], { allowFailure: true });
  if (migrateCode !== 0) {
    console.warn(
      "[build] prisma migrate deploy failed. Continuing because the database may already be migrated.",
    );
  }
}

run(["next", "build"]);
