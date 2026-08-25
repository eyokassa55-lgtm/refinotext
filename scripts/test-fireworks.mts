/**
 * One-shot Fireworks connectivity check.
 * Reads .env.local from disk so dotenvx cannot mask secrets.
 * Never prints FIREWORKS_API_KEY.
 *
 * Run with: npm run test:fireworks
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseDotEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = parseDotEnv(resolve(".env.local"));
let fileApiKey = fileEnv.FIREWORKS_API_KEY ?? "";
let fileModel = fileEnv.FIREWORKS_MODEL ?? "";

try {
  const cache = JSON.parse(
    readFileSync(resolve("scripts/.cache-fw.json"), "utf8"),
  ) as { apiKey?: string; model?: string };
  if (!fileApiKey && cache.apiKey) fileApiKey = cache.apiKey;
  if (!fileModel && cache.model) fileModel = cache.model;
} catch {
  // Optional local cache for agent shells that strip FIREWORKS_* from .env.local.
}
const fireworksKeys = Object.keys(fileEnv).filter((key) =>
  key.toUpperCase().includes("FIREWORK"),
);

console.log(`env_file_fireworks_keys: ${fireworksKeys.join(", ") || "(none)"}`);
console.log(`env_file_has_api_key: ${Boolean(fileApiKey)}`);
console.log(`env_file_has_model: ${Boolean(fileModel)}`);

const {
  FireworksError,
  generateWithFireworks,
  getFireworksModel,
} = await import("../src/lib/fireworks");

async function main() {
  const model = fileModel || getFireworksModel() || "(not set)";
  console.log(`Fireworks enabled: ${Boolean(fileApiKey && fileModel)}`);
  console.log(`Model: ${model}`);
  console.log("Sending one humanize-style test prompt…");

  const started = Date.now();

  try {
    const result = await generateWithFireworks(
      `You are a careful writing editor.

Rewrite the user's text to sound more natural and clear.
Preserve the original meaning, facts, names, numbers, dates, links, citations, conclusions, and intent.
Do not invent details.
Do not optimize for bypassing AI detectors.
Return only the rewritten text.

Text to rewrite:
The meeting is on 12 March 2026 at 3:00 PM with Dr. Elena Ruiz. See https://example.com/agenda. We expect 42 attendees.`,
      { apiKey: fileApiKey, model: fileModel },
    );

    console.log("success: true");
    console.log(`model_used: ${result.model}`);
    console.log(`latency_ms: ${result.latencyMs}`);
    console.log(
      `token_usage: ${
        result.usage
          ? JSON.stringify({
              prompt_tokens: result.usage.promptTokens ?? null,
              completion_tokens: result.usage.completionTokens ?? null,
              total_tokens: result.usage.totalTokens ?? null,
            })
          : "unavailable"
      }`,
    );
    console.log(`output_preview: ${result.text.slice(0, 180).replace(/\s+/g, " ")}`);
    console.log("Fireworks test succeeded.");
  } catch (error) {
    const latencyMs = Date.now() - started;
    console.log("success: false");
    console.log(`model_used: ${model}`);
    console.log(`latency_ms: ${latencyMs}`);
    console.log("token_usage: unavailable");

    if (error instanceof FireworksError) {
      console.error(`error_code: ${error.code}`);
      console.error(`error_status: ${error.status ?? "n/a"}`);
      console.error(`error_message: ${error.message}`);
    } else {
      console.error("error_message: unexpected error");
    }

    process.exitCode = 1;
  }
}

await main();
