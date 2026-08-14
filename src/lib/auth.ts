import { auth, currentUser } from "@clerk/nextjs/server";

import { isClerkEnabled } from "@/lib/auth-config";

export async function getAuthUserId(): Promise<string | null> {
  if (!isClerkEnabled) return null;
  const { userId } = await auth();
  return userId;
}

export async function getAuthUser() {
  if (!isClerkEnabled) return null;
  return currentUser();
}

export async function requireAuthUserId(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
