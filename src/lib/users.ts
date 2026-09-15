import { Prisma, type User } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";

import { getAuthUser, getAuthUserId } from "@/lib/auth";
import {
  clerkIdentityFromUser,
  type ClerkIdentity,
} from "@/lib/clerk-identity";
import { provisionFreeTier } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function resolveSignedInClerkProfile(userId: string): Promise<ClerkIdentity | null> {
  try {
    const user = await getAuthUser();
    if (user?.id === userId) return clerkIdentityFromUser(user);
  } catch (error) {
    console.error("[users] currentUser failed", error);
  }

  try {
    if (typeof clerkClient !== "function") return null;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return clerkIdentityFromUser(user);
  } catch (error) {
    console.error("[users] clerkClient.users.getUser failed", error);
    return null;
  }
}

async function persistBillingUser(params: {
  clerkUserId: string;
  email: string;
  name?: string | null;
  polarCustomerId?: string | null;
}): Promise<User> {
  const { clerkUserId, email, name, polarCustomerId } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name?.trim() || null;

  try {
    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: {
        email: normalizedEmail,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(polarCustomerId ? { polarCustomerId } : {}),
      },
      create: {
        clerkUserId,
        email: normalizedEmail,
        name: normalizedName,
        polarCustomerId: polarCustomerId ?? undefined,
      },
    });

    try {
      await provisionFreeTier(user.id);
    } catch (error) {
      console.error("[users] provisionFreeTier failed after upsert", {
        clerkUserId,
        error,
      });
    }

    return user;
  } catch (error) {
    if (isUniqueConflict(error)) {
      const existing = await prisma.user.findUnique({ where: { clerkUserId } });
      if (existing) return existing;
    }
    throw error;
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

export async function ensureBillingUser(params: {
  clerkUserId: string;
  email: string;
  name?: string | null;
  polarCustomerId?: string | null;
}): Promise<User> {
  return persistBillingUser(params);
}
