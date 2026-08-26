import { NextResponse, type NextRequest } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { OrderSubscription } from "@polar-sh/sdk/models/components/ordersubscription.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { SubscriptionStatus as AppSubscriptionStatus, User } from "@prisma/client";

import { getBillingProductByProductId } from "@/lib/billing";
import { grantCredits } from "@/lib/credits";
import { env } from "@/lib/env";
import { redactPolarSecrets } from "@/lib/polar-error";
import { prisma } from "@/lib/prisma";
import { ensureBillingUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class PolarWebhookSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolarWebhookSkipError";
  }
}

type MetadataValue = string | number | boolean | Date | null | undefined;
type PolarMetadata = Record<string, MetadataValue>;
type WebhookCustomer = {
  id: string;
  externalId?: string | null;
  email?: string | null;
  name?: string | null;
};

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

function logWebhook(
  status: number,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    sanitized[key] =
      typeof value === "string" ? redactPolarSecrets(value) : value;
  }
  console.info("[polar/webhook]", { status, ...sanitized });
}

function webhookHeaders(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function eventDataId(event: { data?: { id?: string } }): string | null {
  const id = event.data?.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function asString(value: MetadataValue): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function toDate(value: Date | string | null | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  throw new PolarWebhookSkipError(
    "Polar webhook payload is missing a valid period date.",
  );
}

function mapStatus(status: string): AppSubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "canceled":
      return "CANCELED";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "EXPIRED";
  }
}

function getPeriodGrantRequestId(
  subscriptionId: string,
  currentPeriodStart: Date,
): string {
  return `polar:subscription:${subscriptionId}:period:${currentPeriodStart.toISOString()}`;
}

async function resolveBillingUser(params: {
  clerkUserId?: string | null;
  appUserId?: string | null;
  email?: string | null;
  name?: string | null;
  polarCustomerId?: string | null;
}): Promise<User> {
  const { clerkUserId, appUserId, email, name, polarCustomerId } = params;

  if (appUserId) {
    const existing = await prisma.user.findUnique({ where: { id: appUserId } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          email: email ?? existing.email,
          name: name ?? existing.name,
          polarCustomerId: polarCustomerId ?? existing.polarCustomerId,
        },
      });
    }
  }

  if (clerkUserId) {
    const existing = await prisma.user.findUnique({ where: { clerkUserId } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          email: email ?? existing.email,
          name: name ?? existing.name,
          polarCustomerId: polarCustomerId ?? existing.polarCustomerId,
        },
      });
    }
  }

  if (polarCustomerId) {
    const existing = await prisma.user.findUnique({
      where: { polarCustomerId },
    });
    if (existing) return existing;
  }

  if (!clerkUserId || !email) {
    throw new PolarWebhookSkipError(
      "Polar webhook payload is missing Clerk user identity.",
    );
  }

  return ensureBillingUser({
    clerkUserId,
    email,
    name,
    polarCustomerId,
  });
}

async function handleSubscription(
  subscription: Subscription | OrderSubscription,
  customer?: WebhookCustomer | null,
) {
  const product = getBillingProductByProductId(subscription.productId);
  if (!product || product.kind !== "subscription") return;

  const metadata = (subscription.metadata ?? {}) as PolarMetadata;
  const nestedCustomer =
    "customer" in subscription
      ? (subscription.customer as WebhookCustomer | null | undefined)
      : null;
  const clerkUserId =
    asString(metadata.clerkUserId) ??
    customer?.externalId ??
    nestedCustomer?.externalId ??
    null;
  const appUserId = asString(metadata.userId);
  const user = await resolveBillingUser({
    clerkUserId,
    appUserId,
    email: customer?.email ?? nestedCustomer?.email ?? null,
    name: customer?.name ?? nestedCustomer?.name ?? null,
    polarCustomerId: subscription.customerId,
  });

  const status = mapStatus(subscription.status);
  const currentPeriodStart = toDate(subscription.currentPeriodStart);
  const currentPeriodEnd = toDate(subscription.currentPeriodEnd);

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      polarCustomerId: subscription.customerId,
      polarSubscriptionId: subscription.id,
      polarProductId: subscription.productId,
      interval: product.interval,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: product.tier,
      status,
      monthlyCredits: product.credits,
      maxWordsPerRequest: product.maxWordsPerRequest,
      currentPeriodStart,
      currentPeriodEnd,
    },
    create: {
      userId: user.id,
      polarCustomerId: subscription.customerId,
      polarSubscriptionId: subscription.id,
      polarProductId: subscription.productId,
      interval: product.interval,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: product.tier,
      status,
      monthlyCredits: product.credits,
      maxWordsPerRequest: product.maxWordsPerRequest,
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  if (status !== "ACTIVE") return;

  await grantCredits({
    userId: user.id,
    amount: product.credits,
    requestId: getPeriodGrantRequestId(subscription.id, currentPeriodStart),
    description: `${product.name} subscription credits`,
  });
}

async function handleOrderPaid(order: Order) {
  if (!order.paid) return;

  const productId = order.productId ?? order.product?.id ?? null;
  if (!productId) return;

  const product = getBillingProductByProductId(productId);
  if (!product) return;

  const metadata = (order.metadata ?? {}) as PolarMetadata;
  const customer = order.customer;
  const clerkUserId =
    asString(metadata.clerkUserId) ?? customer.externalId ?? null;
  const appUserId = asString(metadata.userId);

  if (product.kind === "subscription" && order.subscription) {
    await handleSubscription(order.subscription, customer);
    return;
  }

  if (product.kind !== "topup") return;

  const user = await resolveBillingUser({
    clerkUserId,
    appUserId,
    email: customer.email ?? null,
    name: customer.name ?? null,
    polarCustomerId: order.customerId,
  });

  await grantCredits({
    userId: user.id,
    amount: product.credits,
    requestId: `polar:order:${order.id}:topup`,
    description: `${product.name} one-time credit top-up`,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "polar-webhook" });
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  if (!env.polar.webhookSecret) {
    logWebhook(500, { code: "WEBHOOK_SECRET_MISSING" });
    return errorResponse(
      "POLAR_WEBHOOK_SECRET is not configured.",
      "WEBHOOK_SECRET_MISSING",
      500,
    );
  }

  const body = await req.text();
  const headerRecord = webhookHeaders(req.headers);
  const hasSignature = Boolean(headerRecord["webhook-signature"]);

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headerRecord, env.polar.webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      logWebhook(400, {
        code: "INVALID_SIGNATURE",
        hasSignature,
        errorName: error.name,
      });
      return errorResponse("Invalid webhook signature.", "INVALID_SIGNATURE", 400);
    }

    if (error instanceof SDKValidationError) {
      logWebhook(200, {
        code: "UNPARSED_EVENT",
        hasSignature,
        errorName: error.name,
        message: error.message.slice(0, 180),
        elapsedMs: Date.now() - started,
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    logWebhook(400, {
      code: "INVALID_WEBHOOK",
      hasSignature,
      errorName: error instanceof Error ? error.name : "Error",
    });
    return errorResponse("Invalid webhook payload.", "INVALID_WEBHOOK", 400);
  }

  const webhookId =
    req.headers.get("webhook-id") ??
    (eventDataId(event) ? `polar:${event.type}:${eventDataId(event)}` : null);

  if (webhookId) {
    const alreadyProcessed = await prisma.processedWebhook.findUnique({
      where: { id: webhookId },
    });
    if (alreadyProcessed) {
      logWebhook(200, {
        code: "DUPLICATE",
        type: event.type,
        elapsedMs: Date.now() - started,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.uncanceled":
      case "subscription.canceled":
      case "subscription.revoked":
      case "subscription.past_due":
        await handleSubscription(event.data);
        break;
      case "order.paid":
        await handleOrderPaid(event.data);
        break;
      default:
        break;
    }

    if (webhookId) {
      await prisma.processedWebhook.createMany({
        data: [
          {
            id: webhookId,
            source: "polar",
            eventType: event.type,
          },
        ],
        skipDuplicates: true,
      });
    }
  } catch (error) {
    if (error instanceof PolarWebhookSkipError) {
      if (webhookId) {
        await prisma.processedWebhook.createMany({
          data: [
            {
              id: webhookId,
              source: "polar",
              eventType: event.type,
            },
          ],
          skipDuplicates: true,
        });
      }
      logWebhook(200, {
        code: "SKIPPED",
        type: event.type,
        errorName: error.name,
        message: error.message,
        elapsedMs: Date.now() - started,
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    logWebhook(500, {
      code: "WEBHOOK_HANDLER_FAILED",
      type: event.type,
      errorName: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
      elapsedMs: Date.now() - started,
    });
    return errorResponse("Webhook processing failed.", "WEBHOOK_HANDLER_FAILED", 500);
  }

  logWebhook(200, {
    code: "OK",
    type: event.type,
    elapsedMs: Date.now() - started,
  });
  return NextResponse.json({ received: true });
}
