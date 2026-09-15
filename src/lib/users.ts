import type { User } from "@prisma/client";

import { getAuthUser, getAuthUserId } from "@/lib/auth";
import { getClerkBackend } from "@/lib/clerk-backend";
import {
  clerkIdentityFromUser,
  type ClerkIdentity,
} from "@/lib/clerk-identity";
import { persistBillingUser } from "@/lib/persist-billing-user";
import { prisma } from "@/lib/prisma";

export { ensureBillingUser, persistBillingUser } from "@/lib/persist-billing-user";

async function resolveSignedInClerkProfile(userId: string): Promise<ClerkIdentity | null> {
  try {
    const user = await getAuthUser();
    if (user?.id === userId) return clerkIdentityFromUser(user);
  } catch (error) {
    console.error("[users] currentUser failed", error);
  }

  try {
    const clerk = getClerkBackend();
    if (!clerk) return null;
    const user = await clerk.users.getUser(userId);
    return clerkIdentityFromUser(user);
  } catch (error) {
    console.error("[users] Clerk Backend getUser failed", error);
    return null;
  }
}

/**
 * Upsert the signed-in Clerk user into Neon.
 * Identity comes only from Clerk's server-side session — never from the browser.
 */
export async function ensureCurrentUser(): Promise<User | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing?.email) return existing;

  const profile = await resolveSignedInClerkProfile(userId);
  const email = profile?.email ?? existing?.email ?? null;
  const name = profile?.name ?? existing?.name ?? null;

  if (!email) {
    if (existing) return existing;
    console.error("[users] cannot create Neon user without an email", {
      clerkUserId: userId,
    });
    return null;
  }

  return persistBillingUser({
    clerkUserId: userId,
    email,
    name,
  });
}
