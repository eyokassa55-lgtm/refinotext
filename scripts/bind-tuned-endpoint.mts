/**
 * Binds Humanize to the TOPN1 Vertex endpoint in .env.local.
 * Does not fall back to OG REFINO, rewrite, v3, v2, or lookup jobs.
 * Sets VERTEX_HUMAN_TEXT_MODEL=1.
 * Never prints private keys.
 */
import { config } from "dotenv";
import { promises as fs } from "node:fs";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

const DEFAULT_JOB_NAME = "TOPN1";

type TuningJob = {
  displayName?: string;
  tunedModelDisplayName?: string;
  state?: string;
  createTime?: string;
  tunedModel?: { endpoint?: string; model?: string };
  supervisedTuningSpec?: { trainingDatasetUri?: string };
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

function isTopn1Job(name: string): boolean {
  return /^TOPN1$/i.test(name.trim());
}

function rewritePromptVersion(job: TuningJob): "v2" | "v4" {
  const uri = job.supervisedTuningSpec?.trainingDatasetUri ?? "";
  if (/v4/i.test(uri) || /rewrite/i.test(uri)) return "v4";
  return "v2";
}

function newestFirst(left: TuningJob, right: TuningJob): number {
  return String(right.createTime ?? "").localeCompare(String(left.createTime ?? ""));
}

function pickTopn1Job(jobs: TuningJob[], preferredName: string): TuningJob | undefined {
  return jobs
    .filter(
      (job) =>
        job.state === "JOB_STATE_SUCCEEDED" &&
        Boolean(job.tunedModel?.endpoint?.trim()) &&
        isTopn1Job(jobName(job)) &&
        nameEquals(jobName(job), preferredName),
    )
    .sort(newestFirst)[0];
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  const location =
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
    cleanEnv(process.env.VERTEX_AI_LOCATION) ??
    "us-central1";
  const envName = cleanEnv(process.env.TUNED_MODEL_JOB_NAME);
  const preferredName = DEFAULT_JOB_NAME;

  if (!project) {
    console.error("GOOGLE_CLOUD_PROJECT is missing.");
    process.exitCode = 1;
    return;
  }

  if (envName && !isTopn1Job(envName)) {
    console.log(`Ignoring TUNED_MODEL_JOB_NAME="${envName}"; Humanize binds TOPN1 only.`);
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
  console.log(`Listed ${jobs.length} tuning job(s). Binding "${preferredName}" only.`);
  for (const job of jobs) {
    console.log(
      `  ${jobName(job) || "(unnamed)"} state=${job.state ?? "unknown"} endpoint=${job.tunedModel?.endpoint ? redact(job.tunedModel.endpoint) : "no"}`,
    );
  }

  const selected = pickTopn1Job(jobs, preferredName);
  const endpoint = selected?.tunedModel?.endpoint?.trim();
  const selectedName = selected ? jobName(selected) : "";

  if (!endpoint || !selected || !isTopn1Job(selectedName)) {
    console.error(
      "No succeeded TOPN1 job with an endpoint was found. Not binding an older lookup-tuned job.",
    );
    process.exitCode = 1;
    return;
  }

  const promptVersion = rewritePromptVersion(selected);
  const envPath = ".env.local";
  let text = await fs.readFile(envPath, "utf8");
  text = upsertLine(text, "TUNED_MODEL_ENDPOINT", endpoint);
  text = upsertLine(text, "VERTEX_AI_TUNED_ENDPOINT", endpoint);
  text = upsertLine(text, "VERTEX_HUMAN_TEXT_MODEL", "1");
  text = upsertLine(text, "VERTEX_REWRITE_PROMPT", promptVersion);
  text = upsertLine(text, "TUNED_MODEL_JOB_NAME", "TOPN1");
  await fs.writeFile(envPath, text, "utf8");

  console.log(`Bound Humanize to "${selectedName}" ${redact(endpoint)}`);
  console.log(
    `Wrote TUNED_MODEL_ENDPOINT, VERTEX_AI_TUNED_ENDPOINT, VERTEX_HUMAN_TEXT_MODEL=1, VERTEX_REWRITE_PROMPT=${promptVersion}, and TUNED_MODEL_JOB_NAME=TOPN1 in .env.local`,
  );
}

await main();
