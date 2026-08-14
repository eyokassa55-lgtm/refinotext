// Clerk is considered configured only when a real publishable key is present.
// IMPORTANT: only NEXT_PUBLIC_ vars can be used here — this flag is read on
// both the server and the client, and it must produce the same value in both
// environments or React hydration will fail.
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export const isClerkEnabled =
  publishableKey.startsWith("pk_") && !publishableKey.includes("placeholder");

export const clerkPublishableKey = publishableKey;
