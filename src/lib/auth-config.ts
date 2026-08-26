// Clerk is considered configured only when a real publishable key is present.
// IMPORTANT: only NEXT_PUBLIC_ vars can be used here — this flag is read on
// both the server and the client, and it must produce the same value in both
// environments or React hydration will fail.
const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "")
  .trim()
  .replace(/^["']|["']$/g, "");

function publicPath(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? "").trim().replace(/^["']|["']$/g, "");
  return cleaned || fallback;
}

export const isClerkEnabled =
  publishableKey.startsWith("pk_") && !publishableKey.includes("placeholder");

export const clerkPublishableKey = publishableKey;

export const isClerkDevelopmentKey = publishableKey.startsWith("pk_test_");
export const isClerkProductionKey = publishableKey.startsWith("pk_live_");

export const clerkSignInUrl = publicPath(
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  "/sign-in",
);
export const clerkSignUpUrl = publicPath(
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  "/sign-up",
);
export const clerkAfterSignInUrl = publicPath(
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
  "/",
);
export const clerkAfterSignUpUrl = publicPath(
  process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  "/",
);

export const clerkAllowedRedirectOrigins = [
  "https://www.refinotext.com",
  "https://refinotext.com",
  "http://localhost:3000",
];
