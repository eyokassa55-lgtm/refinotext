/**
 * Sync Vertex Humanize env vars from .env.local to Vercel Production.
 * Usage: node scripts/sync-vercel-vertex-env.mjs
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const TARGET = "production";
const KEYS = [
  "TUNED_MODEL_ENDPOINT",
  "VERTEX_AI_TUNED_ENDPOINT",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
];

function parseEnvFile(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function redact(value, key) {
  if (key.includes("SERVICE_ACCOUNT") || key.includes("API_KEY") || key.includes("SECRET")) {
    return "[redacted]";
  }
  const match = value.match(/\/(endpoints\/[^/?#]+)/);
  return match?.[1] ?? value;
}

function runVercel(args, input) {
  const result = spawnSync("npx", ["vercel", ...args], {
    input,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
    encoding: "utf8",
  });
  return result.status ?? 1;
}

const env = parseEnvFile(readFileSync(".env.local", "utf8"));

for (const key of KEYS) {
  const value = env[key]?.trim();
  if (!value) {
    console.log(`skip ${key} (missing in .env.local)`);
    continue;
  }

  console.log(`\nUpdating ${key} → ${redact(value, key)}`);
  runVercel(["env", "rm", key, TARGET, "--yes"]);
  const code = runVercel(["env", "add", key, TARGET], value);
  if (code !== 0) {
    console.error(`Failed to set ${key} on Vercel (${code})`);
    process.exit(code);
  }
}

console.log("\nDone. Redeploy production for changes to take effect.");
