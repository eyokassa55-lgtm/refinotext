import { getAppUrl } from "@/lib/app-url";

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

function getEnv(key: string): string | undefined {
  return cleanEnv(process.env[key]);
}

function requireEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get appUrl() {
    return getAppUrl();
  },

  clerk: {
    publishableKey: getEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    secretKey: getEnv("CLERK_SECRET_KEY"),
    webhookSigningSecret: getEnv("CLERK_WEBHOOK_SIGNING_SECRET"),
  },

  database: {
    url: getEnv("DATABASE_URL"),
    directUrl: getEnv("DIRECT_URL"),
  },

  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
    model: getEnv("GEMINI_MODEL") ?? "gemini-2.5-flash",
  },

  polar: {
    get accessToken() {
      const value = getEnv("POLAR_ACCESS_TOKEN");
      if (!value || value === "placeholder") return undefined;
      return value;
    },
    get webhookSecret() {
      const value = getEnv("POLAR_WEBHOOK_SECRET");
      if (!value || value === "placeholder") return undefined;
      return value;
    },
    get server() {
      return getEnv("POLAR_SERVER") === "production" ? "production" : "sandbox";
    },
  },
} as const;

export { requireEnv };
