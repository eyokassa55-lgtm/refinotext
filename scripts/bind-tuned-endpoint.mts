/**
 * Binds Humanize to a rewrite-trained Vertex endpoint in .env.local.
 *
 * Preference order:
 * 1. TUNED_MODEL_JOB_NAME (default: OG REFINO rewrite)
 * 2. OG REFINO rewrite
 * 3. OG REFINO v3 (trained on humanizer_train_v2.jsonl)
 * 4. OG REFINO v2 (same ai_text → human_text mapping)
 *
 * Never binds lookup-tuned OG REFINO or identity human_text jobs.
 * Sets VERTEX_HUMAN_TEXT_MODEL=1 for every rewrite-mapping bind.
 * Never prints private keys.
 */
import { config } from "dotenv";
import { promises as fs } from "node:fs";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

const DEFAULT_JOB_NAME = "OG REFINO rewrite";
const FALLBACK_REWRITE_JOBS = ["OG REFINO rewrite", "OG REFINO v3", "OG REFINO v2"];

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

function nameEquals(actual: string, expected: string): boolean {
  const pattern = new RegExp(
    `^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*")}$`,
    "i",
  );
  return pattern.test(actual);
}

function isLookupOrIdentityJob(name: string): boolean {
  const trimmed = name.trim();
  if (/^OG REFINO$/i.test(trimmed)) return true;
  if (/human_text/i.test(trimmed)) return true;
  if (/^REFINO TEXT$/i.test(trimmed)) return true;
  if (/^refino text$/i.test(trimmed)) return true;
  if (/^refino correct$/i.test(trimmed)) return true;
  return false;
}

function isRewriteMappingJob(name: string): boolean {
  if (isLookupOrIdentityJob(name)) return false;
  if (/rewrite/i.test(name)) return true;
  if (/^OG REFINO v[23]$/i.test(name)) return true;
  return false;
}

function rewritePromptVersion(name: string): "v2" | "v4" {
  return /rewrite/i.test(name) ? "v4" : "v2";
}

function newestFirst(left: TuningJob, right: TuningJob): number {
  return String(right.createTime ?? "").localeCompare(String(left.createTime ?? ""));
}

function pickRewriteTrainedJob(
  jobs: TuningJob[],
  preferredName: string,
): TuningJob | undefined {
  const succeeded = jobs
    .filter(
      (job) =>
        job.state === "JOB_STATE_SUCCEEDED" &&
        Boolean(job.tunedModel?.endpoint?.trim()) &&
        isRewriteMappingJob(jobName(job)),
    )
    .sort(newestFirst);

  const byName = (expected: string): TuningJob | undefined =>
    succeeded.filter((job) => nameEquals(jobName(job), expected)).sort(newestFirst)[0];

  const preferred = byName(preferredName);
  if (preferred) return preferred;

  for (const name of FALLBACK_REWRITE_JOBS) {
    const job = byName(name);
    if (job) return job;
  }

  return succeeded[0];
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  const location =
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
    cleanEnv(process.env.VERTEX_AI_LOCATION) ??
    "us-central1";
  const preferredName = cleanEnv(process.env.TUNED_MODEL_JOB_NAME) ?? DEFAULT_JOB_NAME;

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
  console.log(`Listed ${jobs.length} tuning job(s). Preferred name: "${preferredName}"`);
  for (const job of jobs) {
    console.log(
      `  ${jobName(job) || "(unnamed)"} state=${job.state ?? "unknown"} endpoint=${job.tunedModel?.endpoint ? redact(job.tunedModel.endpoint) : "no"}`,
    );
  }

  const selected = pickRewriteTrainedJob(jobs, preferredName);
  const endpoint = selected?.tunedModel?.endpoint?.trim();
  const selectedName = selected ? jobName(selected) : "";

  if (!endpoint || !selected || !isRewriteMappingJob(selectedName)) {
    console.error(
      "No succeeded rewrite-trained job with an endpoint was found (OG REFINO rewrite, v3, or v2). Not binding an older lookup-tuned job.",
    );
    process.exitCode = 1;
    return;
  }

  const promptVersion = rewritePromptVersion(selectedName);
  const envPath = ".env.local";
  let text = await fs.readFile(envPath, "utf8");
  text = upsertLine(text, "TUNED_MODEL_ENDPOINT", endpoint);
  text = upsertLine(text, "VERTEX_AI_TUNED_ENDPOINT", endpoint);
  text = upsertLine(text, "VERTEX_HUMAN_TEXT_MODEL", "1");
  text = upsertLine(text, "VERTEX_REWRITE_PROMPT", promptVersion);
  await fs.writeFile(envPath, text, "utf8");

  console.log(`Bound Humanize to "${selectedName}" ${redact(endpoint)}`);
  console.log(
    `Wrote TUNED_MODEL_ENDPOINT, VERTEX_AI_TUNED_ENDPOINT, VERTEX_HUMAN_TEXT_MODEL=1, and VERTEX_REWRITE_PROMPT=${promptVersion} in .env.local`,
  );
}

await main();
