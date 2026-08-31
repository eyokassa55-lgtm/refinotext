/**
 * Lists Vertex AI tuning jobs / endpoints so we can bind Humanize
 * to "refino correct" without inventing an endpoint ID.
 * Never prints private keys or the full service-account JSON.
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

function redactResource(value: string | undefined): string {
  if (!value) return "(none)";
  const match = value.match(/\/((?:endpoints|models|tuningJobs)\/[^/?#]+)/);
  return match?.[1] ?? value.replace(/^projects\/[^/]+\//, "projects/[id]/");
}

async function getJson(
  token: string,
  url: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, body };
}

function summarizeJob(job: Record<string, unknown>) {
  const tuned =
    job.tunedModel && typeof job.tunedModel === "object"
      ? (job.tunedModel as Record<string, unknown>)
      : {};
  const supervised =
    job.supervisedTuningSpec && typeof job.supervisedTuningSpec === "object"
      ? (job.supervisedTuningSpec as Record<string, unknown>)
      : {};
  return {
    name: redactResource(typeof job.name === "string" ? job.name : undefined),
    displayName: job.displayName ?? job.tunedModelDisplayName ?? null,
    state: job.state ?? null,
    baseModel: job.baseModel ?? job.baseModelId ?? supervised.baseModel ?? null,
    endpoint: redactResource(
      typeof tuned.endpoint === "string" ? tuned.endpoint : undefined,
    ),
    model: redactResource(typeof tuned.model === "string" ? tuned.model : undefined),
    createTime: job.createTime ?? null,
  };
}

function summarizeEndpoint(item: Record<string, unknown>) {
  const models = Array.isArray(item.deployedModels) ? item.deployedModels : [];
  return {
    name: redactResource(typeof item.name === "string" ? item.name : undefined),
    displayName: item.displayName ?? null,
    deployed: models.map((model) => {
      const row = model as Record<string, unknown>;
      return {
        displayName: row.displayName ?? null,
        model: redactResource(typeof row.model === "string" ? row.model : undefined),
      };
    }),
  };
}

async function main() {
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT);
  const location =
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ??
    cleanEnv(process.env.VERTEX_AI_LOCATION) ??
    "us-central1";
  const configured =
    cleanEnv(process.env.TUNED_MODEL_ENDPOINT) ??
    cleanEnv(process.env.VERTEX_AI_TUNED_ENDPOINT);

  console.log("project:", project ? "set" : "missing");
  console.log("location:", location);
  console.log("configured endpoint:", redactResource(configured));
  console.log("TUNED_MODEL_ENDPOINT:", cleanEnv(process.env.TUNED_MODEL_ENDPOINT) ? "set" : "missing");
  console.log("VERTEX_AI_TUNED_ENDPOINT:", cleanEnv(process.env.VERTEX_AI_TUNED_ENDPOINT) ? "set" : "missing");

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

  const hosts = [
    `https://${location}-aiplatform.googleapis.com`,
    "https://aiplatform.googleapis.com",
  ];
  const versions = ["v1", "v1beta1"];

  for (const host of hosts) {
    for (const version of versions) {
      const base = `${host}/${version}/projects/${project}/locations/${location}`;
      for (const path of ["tuningJobs", "endpoints", "models"]) {
        const url = `${base}/${path}?pageSize=50`;
        const result = await getJson(token, url);
        console.log(`\nGET ${version} ${path} [${result.status}]`);
        if (!result.ok) {
          const err = result.body as { error?: { message?: string; status?: string } };
          console.log("  error:", err.error?.status ?? err.error?.message ?? result.status);
          continue;
        }

        const body = result.body as Record<string, unknown>;
        const items = (body.tuningJobs ?? body.endpoints ?? body.models ?? []) as Record<
          string,
          unknown
        >[];
        if (!Array.isArray(items) || items.length === 0) {
          console.log("  (empty)");
          continue;
        }

        for (const item of items) {
          const display = String(item.displayName ?? item.tunedModelDisplayName ?? "");
          const interesting =
            /refino/i.test(display) ||
            /refino/i.test(JSON.stringify(item).slice(0, 4000));
          if (path === "tuningJobs") {
            const summary = summarizeJob(item);
            console.log("  job:", JSON.stringify(summary));
          } else if (path === "endpoints") {
            const summary = summarizeEndpoint(item);
            if (interesting || items.length <= 20) {
              console.log("  endpoint:", JSON.stringify(summary));
            }
          } else {
            if (interesting || items.length <= 20) {
              console.log(
                "  model:",
                JSON.stringify({
                  name: redactResource(typeof item.name === "string" ? item.name : undefined),
                  displayName: item.displayName ?? null,
                  versionId: item.versionId ?? null,
                }),
              );
            }
          }
        }
        if (path === "models" && items.length > 20) {
          console.log(`  (${items.length} models; showing Refino-related or first 20)`);
        }
      }
    }
  }
}

await main();
