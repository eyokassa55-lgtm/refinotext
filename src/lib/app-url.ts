export const PRODUCTION_APP_URL = "https://refinotext.com";
export const PRODUCTION_HOST = "refinotext.com";
export const LEGACY_APP_HOSTS = ["refinotext.vercel.app"] as const;

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

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Public site origin for canonical, sitemap, Open Graph, and JSON-LD.
 * `next dev` keeps localhost. Production builds and Vercel always use
 * https://refinotext.com — never the old Vercel hostname.
 */
export function getAppUrl(): string {
  const explicit = toOrigin(cleanEnvValue(process.env.NEXT_PUBLIC_APP_URL));

  if (process.env.NODE_ENV !== "production") {
    if (explicit) {
      const hostname = new URL(explicit).hostname.toLowerCase();
      if (isLocalHost(hostname)) return explicit;
    }
    return FALLBACK_APP_URL;
  }

  // Production canonical host is always the apex domain, even if the env
  // var is missing, uses www, or still points at the old Vercel hostname.
  if (explicit) {
    const hostname = new URL(explicit).hostname.toLowerCase();
    if (hostname === PRODUCTION_HOST || hostname === `www.${PRODUCTION_HOST}`) {
      return PRODUCTION_APP_URL;
    }
  }

  return PRODUCTION_APP_URL;
}

export function getAbsoluteUrl(path = "/"): string {
  const origin = getAppUrl();
  if (!path || path === "/") return origin;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function isLegacyAppHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return LEGACY_APP_HOSTS.includes(hostname as (typeof LEGACY_APP_HOSTS)[number]);
}
