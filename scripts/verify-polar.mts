/**
 * Verify Polar access token and existing product IDs.
 * Never prints POLAR_ACCESS_TOKEN.
 */
import { config } from "dotenv";

config({ path: ".env.local", override: true });
config({ override: false });

const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim() ?? "";
const configuredServer =
  process.env.POLAR_SERVER === "production" ? "production" : "sandbox";

const { Polar } = await import("@polar-sh/sdk");

const PRODUCT_IDS = [
  ["Basic monthly", "04111bf1-c98e-4892-8469-70d148e9be75"],
  ["Pro monthly", "09e79099-6e23-472c-be09-6183b1447374"],
  ["Ultra monthly", "1e9f065f-b7a0-464c-8faf-09af5506c09e"],
  ["Basic yearly", "34f95e97-e208-47b2-9c07-1df713fcebc1"],
  ["Pro yearly", "ec56c87b-e882-4016-a9b2-4e294dc2af57"],
  ["Ultra yearly", "4e1009f9-5795-4b2b-937f-c688ccefa654"],
  ["Basic top-up", "f5e4fdad-971b-463e-a589-ab5d46d25f51"],
  ["Pro top-up", "84ec06e7-1b52-492c-af9c-6aa3b324a381"],
  ["Ultra top-up", "ad287770-4aa4-4c32-8010-4c74386ffb14"],
] as const;

function redact(value: string): string {
  return value
    .replace(/polar_oat_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/polar_at_[A-Za-z0-9]+/g, "[redacted]");
}

function isUsableToken(token: string): boolean {
  return token.startsWith("polar_oat_") || token.startsWith("polar_at_");
}

async function probe(server: "sandbox" | "production") {
  const polar = new Polar({ accessToken, server });
  const found: string[] = [];
  const missing: string[] = [];

  for (const [label, id] of PRODUCT_IDS) {
    try {
      const product = await polar.products.get({ id });
      found.push(`${label} (${product.name}, recurring=${product.isRecurring})`);
    } catch (error) {
      const message =
        error instanceof Error ? redact(error.message) : "unknown error";
      missing.push(`${label}: ${message.slice(0, 160)}`);
    }
  }

  return { found, missing };
}

console.log(
  `Token usable=${isUsableToken(accessToken)} length=${accessToken.length} prefix=${accessToken.slice(0, 9) || "none"}`,
);
console.log(`Configured POLAR_SERVER=${configuredServer}`);

if (!isUsableToken(accessToken)) {
  console.error("POLAR_ACCESS_TOKEN is missing or still a placeholder.");
  console.error(
    "If you are running this from a Cursor agent shell, dotenv may mask secrets. Run `npm run test:polar` in your own terminal instead.",
  );
  process.exit(1);
}

for (const server of ["sandbox", "production"] as const) {
  console.log(`\nTrying Polar ${server}…`);
  const result = await probe(server);
  console.log(`Found ${result.found.length}/${PRODUCT_IDS.length} products`);
  for (const line of result.found) console.log(`  OK  ${line}`);
  for (const line of result.missing) console.log(`  MISS ${line}`);
  if (result.found.length === PRODUCT_IDS.length) {
    console.log(`\nPolar token works on ${server}.`);
    if (configuredServer !== server) {
      console.log(`Set POLAR_SERVER=${server} in .env.local.`);
    }
    process.exit(0);
  }
}

process.exitCode = 1;
