import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import { isClerkEnabled } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { ensureBillingUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

function clerkEmail(data: {
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
}): string | null {
  const emails = data.email_addresses ?? [];
  const primary = emails.find((entry) => entry.id === data.primary_email_address_id);
  return primary?.email_address ?? emails[0]?.email_address ?? null;
}

function clerkName(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string | null {
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return name || data.username || null;
}

export async function POST(req: NextRequest) {
  if (!isClerkEnabled) {
    return errorResponse("Clerk is not configured", "NOT_CONFIGURED", 503);
  }

  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return errorResponse(
      "CLERK_WEBHOOK_SIGNING_SECRET is not configured.",
      "WEBHOOK_SECRET_MISSING",
      500,
    );
  }

  try {
    const event = await verifyWebhook(req);

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const email = clerkEmail(event.data);
        if (!email) break;

        await ensureBillingUser({
          clerkUserId: event.data.id,
          email,
          name: clerkName(event.data),
        });
        break;
      }
      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (!clerkUserId) break;

        await prisma.user.deleteMany({
          where: { clerkUserId },
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return errorResponse("Webhook verification failed", "INVALID_SIGNATURE", 400);
  }
}
