/**
 * Print trainingDatasetUri from a Vertex tuning job.
 */
import { config } from "dotenv";
import { GoogleAuth } from "google-auth-library";

config({ path: ".env.local" });
config();

const { getGoogleAuthOptions } = await import("../src/lib/vertex-auth");

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT)!;
const location = cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ?? "us-central1";
const jobId = process.argv[2] ?? "6786652655348350976";

const auth = new GoogleAuth({
  ...getGoogleAuthOptions(),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const tokenResponse = await client.getAccessToken();
const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/tuningJobs/${jobId}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
const spec = body.supervisedTuningSpec ?? {};
console.log(JSON.stringify({
  displayName: body.tunedModelDisplayName ?? body.displayName,
  trainingDatasetUri: spec.trainingDatasetUri,
  validationDatasetUri: spec.validationDatasetUri,
  state: body.state,
}, null, 2));
