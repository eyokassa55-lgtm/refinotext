/**
 * Copies the succeeded "REFINO TEXT" tuning job's endpoint into .env.local.
 * Ignores the failed lowercase "refino text" job. Does not create a tuning job.
 * Never prints private keys.
 */
import { config } from "dotenv";
import { promises as fs } from "node:fs";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

const SUCCESS_JOB_NAME = "REFINO TEXT";
const FAILED_JOB_NAME = "refino text";

type TuningJob = {
  displayName?: string;
  tunedModelDisplayName?: string;
  state?: string;
  createTime?: string;
  tunedModel?: { endpoint?: string; model?: string };
};

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

function redact(value: string): string {
  const match = value.match(/\/((?:endpoints|models|tuningJobs)\/[^/?#]+)/);
  return match?.[1] ?? "tuned-endpoint";
}

function jobName(job: TuningJob): string {
  return String(job.displayName ?? job.tunedModelDisplayName ?? "").trim();
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
    tuningJobs?: TuningJob[];
  };

  if (!res.ok) {
    console.error("Could not list tuning jobs:", body.error?.message ?? res.status);
    process.exitCode = 1;
    return;
  }

  const jobs = body.tuningJobs ?? [];
  console.log(`Listed ${jobs.length} tuning job(s).`);
  for (const job of jobs) {
    console.log(
      `  ${jobName(job) || "(unnamed)"} state=${job.state ?? "unknown"} endpoint=${job.tunedModel?.endpoint ? "yes" : "no"}`,
    );
  }

  const failed = jobs.find(
    (job) => /^refino\s*text$/i.test(jobName(job)) && job.state !== "JOB_STATE_SUCCEEDED",
  );
  const succeeded = jobs
    .filter(
      (job) =>
        /^refino\s*text$/i.test(jobName(job)) &&
        job.state === "JOB_STATE_SUCCEEDED" &&
        Boolean(job.tunedModel?.endpoint?.trim()),
    )
    .sort((a, b) => String(b.createTime ?? "").localeCompare(String(a.createTime ?? "")))[0];
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
