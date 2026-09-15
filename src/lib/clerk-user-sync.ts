import { clerkIdentityFromUser } from "@/lib/clerk-identity";
import { getClerkBackend } from "@/lib/clerk-backend";
import { ensureBillingUser } from "@/lib/persist-billing-user";

export type ClerkUserSyncResult = {
  scanned: number;
  synced: number;
  skipped: number;
};

export async function syncAllClerkUsersToNeon(
  max = 10_000,
): Promise<ClerkUserSyncResult> {
  const clerk = getClerkBackend();
  if (!clerk) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  const limit = 100;
  let offset = 0;
  let scanned = 0;
  let synced = 0;
  let skipped = 0;

  while (scanned < max) {
    const page = await clerk.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    });
    const users = page.data ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      scanned += 1;
      const identity = clerkIdentityFromUser(user);
      if (!identity.email) {
        skipped += 1;
        continue;
      }
      await ensureBillingUser({
        clerkUserId: identity.clerkUserId,
        email: identity.email,
        name: identity.name,
      });
      synced += 1;
      if (scanned >= max) break;
    }

    offset += users.length;
    if (users.length < limit) break;
  }

  return { scanned, synced, skipped };
}
