function getEnv(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  appUrl: getEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",

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
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  },

  polar: {
    get accessToken() {
      const value = process.env.POLAR_ACCESS_TOKEN?.trim();
      if (!value || value === "placeholder") return undefined;
      return value;
    },
    get webhookSecret() {
      const value = process.env.POLAR_WEBHOOK_SECRET?.trim();
      if (!value || value === "placeholder") return undefined;
      return value;
    },
    get server() {
      return process.env.POLAR_SERVER === "production"
        ? "production"
        : "sandbox";
    },
  },
} as const;

export { requireEnv };
