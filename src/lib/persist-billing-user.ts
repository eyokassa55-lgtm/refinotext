import { Prisma, type User } from "@prisma/client";

import { provisionFreeTier } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function persistBillingUser(params: {
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

export async function ensureBillingUser(params: {
  clerkUserId: string;
  email: string;
  name?: string | null;
  polarCustomerId?: string | null;
}): Promise<User> {
  return persistBillingUser(params);
}
