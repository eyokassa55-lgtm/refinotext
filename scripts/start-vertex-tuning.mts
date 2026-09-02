/**
 * Start a new Vertex supervised tuning job for OG REFINO.
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT
 * - GOOGLE_SERVICE_ACCOUNT_JSON (or ADC)
 * - TRAINING_DATA_GCS_URI=gs://bucket/path/humanizer_trainOG_v4.jsonl
 *   (ai_text → human_text rewrite JSONL — not identity copy)
 *
 * Optional:
 * - VALIDATION_DATA_GCS_URI=gs://bucket/path/humanizer_validationOG_v4.jsonl
 *   (defaults to the training URI so validation is the full set, not a 90-row holdout)
 *
 * Run: npm run train:vertex
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  const location =
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
    cleanEnv(process.env.VERTEX_AI_LOCATION) ??
    "us-central1";
  const datasetUri = cleanEnv(process.env.TRAINING_DATA_GCS_URI);
  const validationUri =
    cleanEnv(process.env.VALIDATION_DATA_GCS_URI) ?? datasetUri;
  const displayName = cleanEnv(process.env.TUNED_MODEL_JOB_NAME) ?? "OG REFINO rewrite";
  const baseModel =
    cleanEnv(process.env.VERTEX_BASE_MODEL) ?? "gemini-2.5-flash-lite";

  if (!project) {
    console.error("GOOGLE_CLOUD_PROJECT is missing.");
    process.exitCode = 1;
    return;
  }
  if (!datasetUri?.startsWith("gs://")) {
    console.error(
      "Set TRAINING_DATA_GCS_URI to a gs:// path for the exported ai_text → human_text Vertex JSONL before training.",
    );
    process.exitCode = 1;
    return;
  }

  const localRows = readFileSync(join(process.cwd(), "data", "training_data.jsonl"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean).length;
  console.log(`Local training rows: ${localRows}`);
  console.log(`Training URI: ${datasetUri}`);
  console.log(`Validation URI: ${validationUri} (full set, not a 90-row holdout)`);
  console.log(`Job name: ${displayName}`);
  console.log(`Base model: ${baseModel}`);
  console.log("Hyperparameters: epochs=8 adapter=8 learningRateMultiplier=5");

  const auth = new GoogleAuth({
    ...getGoogleAuthOptions(),
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

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/tuningJobs`;
  const body = {
    baseModel,
    supervisedTuningSpec: {
      trainingDatasetUri: datasetUri,
      validationDatasetUri: validationUri,
      hyperParameters: {
        epochCount: "8",
        adapterSize: "ADAPTER_SIZE_EIGHT",
        learningRateMultiplier: 5,
      },
    },
    tunedModelDisplayName: displayName,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as {
    name?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    console.error("Tuning job create failed:", payload.error?.message ?? res.status);
    process.exitCode = 1;
    return;
  }

  console.log("Tuning job created:", payload.name ?? "(unknown)");
  console.log("When it succeeds, run: npm run bind:vertex");
}

await main();
