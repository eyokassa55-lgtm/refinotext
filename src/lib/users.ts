import type { User } from "@prisma/client";

import { getAuthUser, getAuthUserId } from "@/lib/auth";
import { provisionFreeTier } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

/**
 * Upsert the signed-in Clerk user into Neon.
 * Identity comes only from Clerk's server-side session — never from the browser.
 */
export async function ensureCurrentUser(): Promise<User | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  // Fast path: the session token alone identifies a user who already exists in
  // Neon. Skipping the Clerk API round-trip and the provisioning upsert here
  // is what keeps every authenticated request (and page render) fast.
  const existing = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) return existing;

  const clerkUser = await getAuthUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  if (!email) return null;

  const name =
    clerkUser.fullName?.trim() ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    null;

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    update: {
      email,
      name,
    },
    create: {
      clerkUserId: userId,
      email,
      name,
    },
  });

  await provisionFreeTier(user.id);

  return user;
}

export async function ensureBillingUser(params: {
  clerkUserId: string;
  email: string;
  name?: string | null;
  polarCustomerId?: string | null;
}): Promise<User> {
  const { clerkUserId, email, name, polarCustomerId } = params;

  const user = await prisma.user.upsert({
    where: { clerkUserId },
    update: {
      email,
      name,
      polarCustomerId: polarCustomerId ?? undefined,
    },
    create: {
      clerkUserId,
      email,
      name,
      polarCustomerId: polarCustomerId ?? undefined,
    },
  });

  await provisionFreeTier(user.id);

  return user;
}
