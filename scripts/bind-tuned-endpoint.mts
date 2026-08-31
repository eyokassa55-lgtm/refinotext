/**
 * Copies the succeeded "refino correct" tuning job's endpoint into .env.local.
 * Does not create a tuning job. Never prints private keys.
 */
import { config } from "dotenv";
import { promises as fs } from "node:fs";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

const SUCCESS_JOB_NAME = "refino correct";
const FAILED_JOB_NAME = "refino text";

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

function redact(value: string): string {
  const match = value.match(/\/((?:endpoints|models|tuningJobs)\/[^/?#]+)/);
  return match?.[1] ?? "tuned-endpoint";
}

function upsertLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  if (/^VERTEX_AI_TUNED_ENDPOINT=/m.test(text)) {
    return text.replace(/^VERTEX_AI_TUNED_ENDPOINT=.*$/m, `${line}\n$&`);
  }
  return `${text.trimEnd()}\n${line}\n`;
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  const location =
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
    cleanEnv(process.env.VERTEX_AI_LOCATION) ??
    "us-central1";

  if (!project) {
    console.error("GOOGLE_CLOUD_PROJECT is missing.");
    process.exitCode = 1;
    return;
  }

  const authOptions = getGoogleAuthOptions();
  const auth = new GoogleAuth({
    ...authOptions,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    console.error("Could not obtain a Google access token.");
    process.exitCode = 1;
    return;
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/tuningJobs?pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as {
    error?: { message?: string };
    tuningJobs?: Array<{
      displayName?: string;
      tunedModelDisplayName?: string;
      state?: string;
      tunedModel?: { endpoint?: string; model?: string };
    }>;
  };

  if (!res.ok) {
    console.error("Could not list tuning jobs:", body.error?.message ?? res.status);
    process.exitCode = 1;
    return;
  }

  const jobs = body.tuningJobs ?? [];
  console.log(`Listed ${jobs.length} tuning job(s).`);
  for (const job of jobs) {
    const name = String(job.displayName ?? job.tunedModelDisplayName ?? "").trim();
    console.log(`  ${name || "(unnamed)"} state=${job.state ?? "unknown"} endpoint=${job.tunedModel?.endpoint ? "yes" : "no"}`);
  }

  const failed = jobs.find((job) => /refino\s*text/i.test(String(job.displayName ?? job.tunedModelDisplayName ?? "")));
  const succeeded = jobs.find((job) => {
    const name = String(job.displayName ?? job.tunedModelDisplayName ?? "").trim();
    return /refino\s*correct/i.test(name) && job.state === "JOB_STATE_SUCCEEDED";
  });
  const endpoint = succeeded?.tunedModel?.endpoint?.trim();

  if (failed) {
    console.log(`Ignoring failed job "${FAILED_JOB_NAME}" (${failed.state}).`);
  }

  if (!endpoint) {
    console.error(
      `Succeeded job "${SUCCESS_JOB_NAME}" was not found, or it has no endpoint. Copy the endpoint from Vertex AI → Tuning → ${SUCCESS_JOB_NAME}.`,
    );
    process.exitCode = 1;
    return;
  }

  const envPath = ".env.local";
  let text = await fs.readFile(envPath, "utf8");
  text = upsertLine(text, "TUNED_MODEL_ENDPOINT", endpoint);
  text = upsertLine(text, "VERTEX_AI_TUNED_ENDPOINT", endpoint);
  await fs.writeFile(envPath, text, "utf8");

  console.log(`Bound Humanize to "${SUCCESS_JOB_NAME}" ${redact(endpoint)}`);
  console.log("Wrote TUNED_MODEL_ENDPOINT and VERTEX_AI_TUNED_ENDPOINT in .env.local");
}

await main();
