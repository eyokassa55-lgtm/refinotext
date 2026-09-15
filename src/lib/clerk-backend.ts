import { createClerkClient, type ClerkClient } from "@clerk/backend";

export function getClerkSecretKey(): string {
  return (process.env.CLERK_SECRET_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}

export function getClerkBackend(): ClerkClient | null {
  const secretKey = getClerkSecretKey();
  if (!secretKey.startsWith("sk_")) return null;
  return createClerkClient({ secretKey });
}
