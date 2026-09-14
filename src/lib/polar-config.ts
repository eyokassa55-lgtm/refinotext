export type PolarServer = "sandbox" | "production";

function readPolarServerEnv(): string {
  return (process.env.POLAR_SERVER ?? "").trim().toLowerCase();
}

export function getExplicitPolarServer(): PolarServer | null {
  const value = readPolarServerEnv();
  if (value === "production" || value === "sandbox") return value;
  return null;
}

/**
 * Polar environment for API calls.
 * Vercel/production defaults to Polar production so a missing POLAR_SERVER
 * no longer silently talks to sandbox with a live token.
 */
export function getConfiguredPolarServer(): PolarServer {
  const explicit = getExplicitPolarServer();
  if (explicit) return explicit;

  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "production";
  }

  return "sandbox";
}
