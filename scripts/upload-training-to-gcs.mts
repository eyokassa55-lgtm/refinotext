/**
 * Create a GCS bucket in this GCP project if needed, then upload the
 * Vertex rewrite-training JSONL.
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT
 * - GOOGLE_SERVICE_ACCOUNT_JSON (or ADC)
 *
 * Optional:
 * - TRAINING_GCS_BUCKET (defaults to refino-og-v2-<project-slug>)
 * - TRAINING_GCS_OBJECT=humanizer_trainOG_v2.jsonl
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

function defaultBucketName(project: string): string {
  const slug = project.match(/[a-f0-9]{8}/i)?.[0]?.toLowerCase() ?? "local";
  return `refino-og-v2-${slug}`;
}

async function listBuckets(token: string, project: string): Promise<string[]> {
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(project)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error(`List buckets failed [${res.status}]:`, (await res.text()).slice(0, 300));
    return [];
  }
  const body = (await res.json()) as { items?: Array<{ name?: string }> };
  return (body.items ?? []).map((item) => item.name).filter((name): name is string => Boolean(name));
}

async function bucketExists(token: string, bucket: string): Promise<boolean> {
  const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function ensureBucket(token: string, project: string, bucket: string) {
  if (await bucketExists(token, bucket)) return;

  const create = await fetch(
    `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(project)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: bucket,
        location: "US-CENTRAL1",
        storageClass: "STANDARD",
        iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
      }),
    },
  );

  if (create.ok || create.status === 409) return;

  const text = await create.text();
  const known = await listBuckets(token, project);
  console.error(`Create bucket failed [${create.status}]: ${text.slice(0, 400)}`);
  if (known.length > 0) {
    console.error(`Buckets this service account can see: ${known.join(", ")}`);
  } else {
    console.error("This service account cannot create or list buckets in the project.");
  }
  throw new Error("GCS_BUCKET_UNAVAILABLE");
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  let bucket = cleanEnv(process.env.TRAINING_GCS_BUCKET) ?? (project ? defaultBucketName(project) : undefined);
  const object = cleanEnv(process.env.TRAINING_GCS_OBJECT) ?? "humanizer_trainOG_v2.jsonl";
  const validationObject =
    cleanEnv(process.env.VALIDATION_GCS_OBJECT) ?? "humanizer_validationOG_v2.jsonl";
  const localPath =
    cleanEnv(process.env.TRAINING_LOCAL_PATH) ??
    join(process.cwd(), "data", "humanizer_train_v2.jsonl");
  const validationPath =
    cleanEnv(process.env.VALIDATION_LOCAL_PATH) ??
    join(process.cwd(), "data", "humanizer_validation_v2.jsonl");

  if (!project) {
    console.error("GOOGLE_CLOUD_PROJECT is missing.");
    process.exitCode = 1;
    return;
  }
  if (!bucket) {
    console.error("Set TRAINING_GCS_BUCKET to the destination bucket name.");
    process.exitCode = 1;
    return;
  }

  const auth = new GoogleAuth({
    ...getGoogleAuthOptions(),
    scopes: [
      "https://www.googleapis.com/auth/devstorage.full_control",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    console.error("Could not obtain a Google access token.");
    process.exitCode = 1;
    return;
  }

  try {
    if (await bucketExists(token, bucket)) {
      console.log(`Using existing bucket ${bucket}`);
    } else {
      await ensureBucket(token, project, bucket);
    }
  } catch (error) {
    const fallbacks = ["ogrefinotext"];
    let used: string | undefined;
    for (const name of fallbacks) {
      console.log(`Trying existing bucket ${name} without list permission`);
      used = name;
      break;
    }
    if (!used) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
      return;
    }
    console.log(`Falling back to existing bucket ${used}`);
    bucket = used;
  }

  async function uploadObject(name: string, path: string) {
    const fileBody = readFileSync(path);
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/jsonl",
      },
      body: fileBody,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed for ${name} [${res.status}]: ${text.slice(0, 500)}`);
    }
    const uri = `gs://${bucket}/${name}`;
    console.log(`Uploaded ${fileBody.length} bytes to ${uri}`);
    return uri;
  }

  try {
    const trainUri = await uploadObject(object, localPath);
    const validationUri = await uploadObject(validationObject, validationPath);
    console.log(`Set TRAINING_DATA_GCS_URI=${trainUri}`);
    console.log(`Set VALIDATION_DATA_GCS_URI=${validationUri}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await main();
