const FALLBACK_APP_URL = "http://localhost:3000";

function cleanEnvValue(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");
}

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function toOrigin(value: string): string | null {
  try {
    const url = new URL(withProtocol(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getAppUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    FALLBACK_APP_URL,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanEnvValue(candidate);
    if (!cleaned) continue;
    const origin = toOrigin(cleaned);
    if (origin) return origin;
  }

  return FALLBACK_APP_URL;
}
