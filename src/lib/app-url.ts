export const PRODUCTION_APP_URL = "https://www.refinotext.com";
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
 * https://www.refinotext.com — never the old Vercel hostname.
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

  // Production canonical host is always www, even if the env var is missing,
  // uses apex, or still points at the old Vercel hostname.
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
  if (!path || path === "/") return `${origin}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function isLegacyAppHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return LEGACY_APP_HOSTS.includes(hostname as (typeof LEGACY_APP_HOSTS)[number]);
}

export function isRefinoProductionHost(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return host === PRODUCTION_HOST || host === `www.${PRODUCTION_HOST}`;
}

function requestHostname(headers: Headers, fallbackUrl: string): string {
  const forwarded = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const host = forwarded.split(",")[0]?.trim().toLowerCase();
  if (host) return host.split(":")[0] ?? host;
  try {
    return new URL(fallbackUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Origin Polar should redirect back to. Matches the host the customer is on
 * (apex or www) so Polar does not reject a success URL that is not allowlisted.
 */
export function getCheckoutOrigin(headers: Headers, fallbackUrl: string): string {
  const hostname = requestHostname(headers, fallbackUrl);
  if (isRefinoProductionHost(hostname)) {
    return `https://${hostname}`;
  }
  if (isLocalHost(hostname)) {
    const proto =
      headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? hostname)
      .split(",")[0]
      ?.trim();
    return `${proto === "https" ? "https" : "http"}://${host || hostname}`;
  }
  return getAppUrl();
}

export function getAlternateRefinoOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (!isRefinoProductionHost(url.hostname)) return null;
    url.hostname =
      url.hostname === PRODUCTION_HOST
        ? `www.${PRODUCTION_HOST}`
        : PRODUCTION_HOST;
    return url.origin;
  } catch {
    return null;
  }
}

export function polarCheckoutSuccessUrl(
  origin: string,
  includeCheckoutPlaceholder = true,
): string {
  const success = new URL("/dashboard", `${origin.replace(/\/$/, "")}/`);
  success.searchParams.set("checkout", "success");
  if (!includeCheckoutPlaceholder) return success.toString();

  // Polar replaces the literal {CHECKOUT_ID}. URLSearchParams encodes braces,
  // so decode them the same way @polar-sh/nextjs does.
  success.searchParams.set("checkout_id", "{CHECKOUT_ID}");
  return decodeURI(success.toString());
}

export function polarCheckoutReturnUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/pricing`;
}
