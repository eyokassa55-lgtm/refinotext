/**
 * Diagnose Polar checkout against the existing Basic Monthly product ID.
 * Reads .env.local from disk so dotenvx cannot mask the token.
 * Never prints POLAR_ACCESS_TOKEN.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseDotEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function redact(value: string): string {
  return value
    .replace(/polar_oat_[A-Za-z0-9]+/g, "[redacted-token]")
    .replace(/polar_at_[A-Za-z0-9]+/g, "[redacted-token]")
    .replace(/polar_whs_[A-Za-z0-9]+/g, "[redacted-secret]")
    .replace(/sk_test_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/sk_live_[A-Za-z0-9]+/g, "[redacted]");
}

function summarizeToken(token: string) {
  return {
    present: Boolean(token),
    usable: token.startsWith("polar_oat_") || token.startsWith("polar_at_"),
    length: token.length,
    prefix: token.slice(0, 9) || "none",
  };
}

function polarErrorInfo(error: unknown) {
  const err = error as {
    name?: string;
    message?: string;
    statusCode?: number;
    body?: string;
    detail?: unknown;
  };
  return {
    name: err?.name ?? "Error",
    statusCode: err?.statusCode ?? null,
    message: redact(String(err?.message ?? error)),
    body: err?.body ? redact(String(err.body).slice(0, 800)) : null,
    detail: err?.detail ?? null,
  };
}

const BASIC_MONTHLY_ID = "04111bf1-c98e-4892-8469-70d148e9be75";
const fileEnv = parseDotEnv(resolve(".env.local"));
const accessToken = fileEnv.POLAR_ACCESS_TOKEN?.trim() ?? "";
const configuredServer =
  fileEnv.POLAR_SERVER === "production" ? "production" : "sandbox";

const { Polar } = await import("@polar-sh/sdk");

console.log("Token from .env.local:", summarizeToken(accessToken));
console.log("Configured POLAR_SERVER:", configuredServer);
console.log("Basic Monthly product ID:", BASIC_MONTHLY_ID);

if (!summarizeToken(accessToken).usable) {
  console.error("POLAR_ACCESS_TOKEN is missing or not a Polar access token.");
  process.exit(1);
}

async function probe(server: "sandbox" | "production") {
  const polar = new Polar({ accessToken, server });
  console.log(`\n=== Polar ${server} ===`);
  try {
    const product = await polar.products.get({ id: BASIC_MONTHLY_ID });
    console.log("products.get HTTP 200");
    console.log({
      id: product.id,
      name: product.name,
      isRecurring: product.isRecurring,
      isArchived: product.isArchived,
      organizationId: product.organizationId,
    });
    return { server, ok: true as const, polar, product };
  } catch (error) {
    console.log("products.get FAILED");
    console.log(polarErrorInfo(error));
    return { server, ok: false as const, polar, error };
  }
}

const sandbox = await probe("sandbox");
const production = await probe("production");
const working = [sandbox, production].find((result) => result.ok);

if (!working || !working.ok) {
  console.error("\nBasic Monthly was not found on sandbox or production.");
  process.exit(1);
}

console.log(`\nUsing ${working.server} for checkout.create probe`);
try {
  const checkout = await working.polar.checkouts.create({
    products: [BASIC_MONTHLY_ID],
    externalCustomerId: "refinotext-diagnose-clerk-user",
    customerEmail: "diagnose@refinotext.local",
    successUrl: "http://localhost:3000/dashboard?checkout=success",
    returnUrl: "http://localhost:3000/pricing",
    metadata: {
      app: "refinotext",
      productKey: "basic_monthly",
      diagnose: true,
    },
  });
  console.log("checkouts.create HTTP 201/200");
  console.log({
    id: checkout.id,
    status: checkout.status,
    urlHost: checkout.url ? new URL(checkout.url).host : null,
    productIds: checkout.products?.map((product) => product.id) ?? [],
  });
} catch (error) {
  console.log("checkouts.create FAILED");
  console.log(polarErrorInfo(error));
  process.exitCode = 1;
}
