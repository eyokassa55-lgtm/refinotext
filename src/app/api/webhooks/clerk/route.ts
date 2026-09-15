import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import {
  clerkIdentityFromUser,
  clerkIdentityFromWebhookData,
  clerkUserIdFromPayload,
} from "@/lib/clerk-identity";
import { prisma } from "@/lib/prisma";
import { ensureBillingUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

function webhookSecret(): string | undefined {
  const value = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim().replace(
    /^["']|["']$/g,
    "",
  );
  return value || undefined;
}

async function emailFromClerkBackend(clerkUserId: string) {
  if (typeof clerkClient !== "function") return null;
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  return clerkIdentityFromUser(user);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "clerk-webhook",
    secretConfigured: Boolean(webhookSecret()),
  });
}

export async function POST(req: NextRequest) {
  const secret = webhookSecret();
  if (!secret) {
    console.error("[clerk/webhook] CLERK_WEBHOOK_SIGNING_SECRET is not configured");
    return errorResponse(
      "CLERK_WEBHOOK_SIGNING_SECRET is not configured.",
      "WEBHOOK_SECRET_MISSING",
      500,
    );
  }

  let event;
  try {
    event = await verifyWebhook(req, { signingSecret: secret });
  } catch (error) {
    console.error("[clerk/webhook] verification failed", error);
    return errorResponse("Webhook verification failed", "INVALID_SIGNATURE", 400);
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
      case "session.created": {
        const identity = clerkIdentityFromWebhookData(event.type, event.data);
        if (!identity) {
          console.error("[clerk/webhook] missing Clerk user id", { type: event.type });
          break;
        }

        let email = identity.email;
        let name = identity.name;
        if (!email) {
          try {
            const fromApi = await emailFromClerkBackend(identity.clerkUserId);
            email = fromApi?.email ?? null;
            name = name ?? fromApi?.name ?? null;
          } catch (error) {
            console.error("[clerk/webhook] backend email lookup failed", {
              clerkUserId: identity.clerkUserId,
              error,
            });
          }
        }

        if (!email) {
          console.error("[clerk/webhook] Clerk user has no email yet", {
            type: event.type,
            clerkUserId: identity.clerkUserId,
          });
          break;
        }

        const user = await ensureBillingUser({
          clerkUserId: identity.clerkUserId,
          email,
          name,
        });
        console.info("[clerk/webhook] synced user", {
          type: event.type,
          clerkUserId: identity.clerkUserId,
          userId: user.id,
        });
        break;
      }
      case "user.deleted": {
        const clerkUserId = clerkUserIdFromPayload(event.data);
        if (!clerkUserId) break;

        const result = await prisma.user.deleteMany({
          where: { clerkUserId },
        });
        console.info("[clerk/webhook] deleted user", {
          clerkUserId,
          count: result.count,
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[clerk/webhook] failed to persist user", error);
    return errorResponse("Failed to persist Clerk user", "USER_SYNC_FAILED", 500);
  }
}
