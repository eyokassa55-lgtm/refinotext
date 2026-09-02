/**
 * Cancel a Vertex tuning job. Usage:
 *   npx tsx scripts/cancel-tuning-job.mts tuningJobs/123
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

const jobId = process.argv[2];
if (!jobId?.startsWith("tuningJobs/")) {
  console.error("Pass a tuningJobs/... id.");
  process.exit(1);
}

const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
const location =
  cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
  cleanEnv(process.env.VERTEX_AI_LOCATION) ??
  "us-central1";
if (!project) {
  console.error("GOOGLE_CLOUD_PROJECT is missing.");
  process.exit(1);
}

const auth = new GoogleAuth({
  ...getGoogleAuthOptions(),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const tokenResponse = await client.getAccessToken();
const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
if (!token) {
  console.error("Could not obtain a Google access token.");
  process.exit(1);
}

const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/${jobId}:cancel`;
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
});
const body = (await res.json()) as { error?: { message?: string } };
if (!res.ok) {
  console.error("Cancel failed:", body.error?.message ?? res.status);
  process.exit(1);
}
console.log(`Cancelled ${jobId}`);
