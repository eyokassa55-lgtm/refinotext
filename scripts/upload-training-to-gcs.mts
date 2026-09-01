/**
 * Upload data/training_data.jsonl to GCS for Vertex tuning.
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT
 * - GOOGLE_SERVICE_ACCOUNT_JSON (or ADC)
 * - TRAINING_GCS_BUCKET=your-bucket-name
 *
 * Optional:
 * - TRAINING_GCS_OBJECT=refino/training_data.jsonl
 *
 * Run: npm run upload:training
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
  const bucket = cleanEnv(process.env.TRAINING_GCS_BUCKET);
  const object =
    cleanEnv(process.env.TRAINING_GCS_OBJECT) ?? "humanizer_trainOG_v2.jsonl";
  const localPath =
    cleanEnv(process.env.TRAINING_LOCAL_PATH) ??
    join(process.cwd(), "data", "humanizer_train_v2.jsonl");
  const body = readFileSync(localPath);

  if (!bucket) {
    console.error("Set TRAINING_GCS_BUCKET to the destination bucket name.");
    process.exitCode = 1;
    return;
  }

  const auth = new GoogleAuth({
    ...getGoogleAuthOptions(),
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    console.error("Could not obtain a Google access token.");
    process.exitCode = 1;
    return;
  }

  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(object)}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/jsonl",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Upload failed [${res.status}]:`, text.slice(0, 500));
    process.exitCode = 1;
    return;
  }

  const uri = `gs://${bucket}/${object}`;
  console.log(`Uploaded ${body.length} bytes to ${uri}`);
  console.log(`Set TRAINING_DATA_GCS_URI=${uri}`);
}

await main();
