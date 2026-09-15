import "server-only";

import type { User } from "@prisma/client";
import type { PlanTier } from "@prisma/client";
import type { SubscriptionStatus as AppSubscriptionStatus } from "@prisma/client";

import { getBillingProductByProductId, type BillingProduct } from "@/lib/billing";
import {
  grantCredits,
  grantSubscriptionPeriodCredits,
  subscriptionPeriodGrantRequestId,
} from "@/lib/credits";
import {
  getPolarCheckout,
  getPolarSubscription,
  listPolarOrdersForCheckout,
  listRecentPaidCheckouts,
} from "@/lib/polar";
import { prisma } from "@/lib/prisma";
import { ensureBillingUser } from "@/lib/users";

export class PolarWebhookSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolarWebhookSkipError";
  }
}

type PolarRecord = Record<string, unknown>;
type PolarMetadata = Record<string, unknown>;

type PolarCustomerInfo = {
  id?: string | null;
  externalId?: string | null;
  email?: string | null;
  name?: string | null;
};

type PolarSubscriptionInfo = {
  id: string;
  productId: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  metadata: PolarMetadata;
  customer?: PolarCustomerInfo | null;
};

type PolarOrderInfo = {
  id: string;
  paid: boolean;
  billingReason: string | null;
  productId: string | null;
  customerId: string;
  subscriptionId: string | null;
  checkoutId: string | null;
  metadata: PolarMetadata;
  customer?: PolarCustomerInfo | null;
  subscription?: PolarSubscriptionInfo | null;
};

export type CheckoutNotice = {
  tone: "success" | "pending" | "error";
  message: string;
};

const POLAR_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): PolarRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PolarRecord;
}

function firstString(record: PolarRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstBoolean(record: PolarRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function firstRecord(record: PolarRecord | null | undefined, keys: string[]): PolarRecord | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asRecord(record[key]);
    if (value) return value;
  }
  return null;
}

function toOptionalDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function metadataOf(record: PolarRecord | null | undefined): PolarMetadata {
  return firstRecord(record, ["metadata"]) ?? {};
}

function normalizeCustomer(value: unknown): PolarCustomerInfo | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    id: firstString(record, ["id"]),
    externalId: firstString(record, ["externalId", "external_id"]),
    email: firstString(record, ["email"]),
    name: firstString(record, ["name"]),
  };
}

function normalizeSubscription(value: unknown): PolarSubscriptionInfo | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = firstString(record, ["id"]);
  const productId = firstString(record, ["productId", "product_id"]);
  const customerId = firstString(record, ["customerId", "customer_id"]);
  if (!id || !productId || !customerId) return null;

  return {
    id,
    productId,
    customerId,
    status: firstString(record, ["status"]) ?? "active",
    cancelAtPeriodEnd:
      firstBoolean(record, ["cancelAtPeriodEnd", "cancel_at_period_end"]) ?? false,
    currentPeriodStart: toOptionalDate(
      record.currentPeriodStart ?? record.current_period_start,
    ),
    currentPeriodEnd: toOptionalDate(
      record.currentPeriodEnd ?? record.current_period_end,
    ),
    metadata: metadataOf(record),
    customer: normalizeCustomer(record.customer),
  };
}

function normalizeOrder(value: unknown, assumePaid = false): PolarOrderInfo | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = firstString(record, ["id"]);
  if (!id) return null;

  const product = firstRecord(record, ["product"]);
  const customer = normalizeCustomer(record.customer);

  return {
    id,
    paid: firstBoolean(record, ["paid"]) ?? assumePaid,
    billingReason: firstString(record, ["billingReason", "billing_reason"]),
    productId:
      firstString(record, ["productId", "product_id"]) ??
      firstString(product, ["id"]),
    customerId:
      firstString(record, ["customerId", "customer_id"]) ?? customer?.id ?? "",
    subscriptionId: firstString(record, ["subscriptionId", "subscription_id"]),
    checkoutId: firstString(record, ["checkoutId", "checkout_id"]),
    metadata: metadataOf(record),
    customer,
    subscription: normalizeSubscription(record.subscription),
  };
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

function periodEndFor(product: BillingProduct, start: Date): Date {
  const end = new Date(start);
  if (product.interval === "year") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

function subscriptionGrantRequestId(params: {
  subscriptionId: string;
  currentPeriodStart: Date | null;
}): string {
  return subscriptionPeriodGrantRequestId(
    params.subscriptionId,
    params.currentPeriodStart,
  );
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
  subscription: PolarSubscriptionInfo,
  customer?: PolarCustomerInfo | null,
  _options?: {
    checkoutId?: string | null;
    billingReason?: string | null;
  },
) {
  const product = getBillingProductByProductId(subscription.productId);
  if (!product || product.kind !== "subscription") return;

  const metadata = subscription.metadata;
  const clerkUserId =
    asString(metadata.clerkUserId) ??
    customer?.externalId ??
    subscription.customer?.externalId ??
    null;
  const appUserId = asString(metadata.userId);
  const user = await resolveBillingUser({
    clerkUserId,
    appUserId,
    email: customer?.email ?? subscription.customer?.email ?? null,
    name: customer?.name ?? subscription.customer?.name ?? null,
    polarCustomerId: subscription.customerId,
  });

  const status = mapStatus(subscription.status);
  const currentPeriodStart = subscription.currentPeriodStart ?? new Date();
  const currentPeriodEnd =
    subscription.currentPeriodEnd ?? periodEndFor(product, currentPeriodStart);

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

  await grantSubscriptionPeriodCredits({
    userId: user.id,
    amount: product.credits,
    requestId: subscriptionGrantRequestId({
      subscriptionId: subscription.id,
      currentPeriodStart,
    }),
    description: `${product.name} subscription credits`,
    periodStart: currentPeriodStart,
  });
}

async function resolveOrderSubscription(
  order: PolarOrderInfo,
): Promise<PolarSubscriptionInfo | null> {
  if (order.subscription) return order.subscription;
  if (!order.subscriptionId) return null;
  try {
    const { subscription } = await getPolarSubscription(order.subscriptionId);
    return normalizeSubscription(subscription);
  } catch (error) {
    console.error("[polar] Failed to load subscription for paid order", {
      orderId: order.id,
      subscriptionId: order.subscriptionId,
      errorName: error instanceof Error ? error.name : "Error",
    });
    return null;
  }
}

async function applySubscriptionFromProduct(params: {
  product: BillingProduct;
  user: User;
  polarCustomerId: string | null;
  subscriptionId: string;
  checkoutId?: string | null;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { userId: params.user.id },
  });
  const keepPeriod =
    existing?.polarSubscriptionId === params.subscriptionId &&
    Boolean(existing.currentPeriodStart);
  const currentPeriodStart = keepPeriod
    ? existing!.currentPeriodStart
    : new Date();
  const currentPeriodEnd = keepPeriod
    ? existing!.currentPeriodEnd ?? periodEndFor(params.product, currentPeriodStart)
    : periodEndFor(params.product, currentPeriodStart);

  await prisma.subscription.upsert({
    where: { userId: params.user.id },
    update: {
      polarCustomerId: params.polarCustomerId ?? undefined,
      polarSubscriptionId: params.subscriptionId,
      polarProductId: params.product.productId,
      interval: params.product.interval,
      cancelAtPeriodEnd: false,
      plan: params.product.tier,
      status: "ACTIVE",
      monthlyCredits: params.product.credits,
      maxWordsPerRequest: params.product.maxWordsPerRequest,
      currentPeriodStart,
      currentPeriodEnd,
    },
    create: {
      userId: params.user.id,
      polarCustomerId: params.polarCustomerId,
      polarSubscriptionId: params.subscriptionId,
      polarProductId: params.product.productId,
      interval: params.product.interval,
      cancelAtPeriodEnd: false,
      plan: params.product.tier,
      status: "ACTIVE",
      monthlyCredits: params.product.credits,
      maxWordsPerRequest: params.product.maxWordsPerRequest,
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  await grantSubscriptionPeriodCredits({
    userId: params.user.id,
    amount: params.product.credits,
    requestId: subscriptionGrantRequestId({
      subscriptionId: params.subscriptionId,
      currentPeriodStart,
    }),
    description: `${params.product.name} subscription credits`,
    periodStart: currentPeriodStart,
  });
}

async function handleOrderPaid(value: unknown, assumePaid = false) {
  const order = normalizeOrder(value, assumePaid);
  if (!order || !order.paid) return;

  const productId = order.productId;
  if (!productId) return;

  const product = getBillingProductByProductId(productId);
  if (!product) return;

  const metadata = order.metadata;
  const customer = order.customer;
  const clerkUserId =
    asString(metadata.clerkUserId) ?? customer?.externalId ?? null;
  const appUserId = asString(metadata.userId);

  if (product.kind === "subscription") {
    const subscription = await resolveOrderSubscription(order);
    if (subscription) {
      await handleSubscription(subscription, customer, {
        checkoutId: order.checkoutId,
        billingReason: order.billingReason,
      });
      return;
    }

    const user = await resolveBillingUser({
      clerkUserId,
      appUserId,
      email: customer?.email ?? null,
      name: customer?.name ?? null,
      polarCustomerId: order.customerId || null,
    });

    await applySubscriptionFromProduct({
      product,
      user,
      polarCustomerId: order.customerId || null,
      subscriptionId: order.subscriptionId ?? `order:${order.id}`,
      checkoutId: order.checkoutId,
    });
    return;
  }

  if (product.kind !== "topup") return;

  const user = await resolveBillingUser({
    clerkUserId,
    appUserId,
    email: customer?.email ?? null,
    name: customer?.name ?? null,
    polarCustomerId: order.customerId || null,
  });

  await grantCredits({
    userId: user.id,
    amount: product.credits,
    requestId: order.checkoutId
      ? `polar:checkout:${order.checkoutId}:grant`
      : `polar:order:${order.id}:topup`,
    description: `${product.name} one-time credit top-up`,
  });
}

export async function processPolarWebhookEvent(type: string, data: unknown) {
  switch (type) {
    case "subscription.created":
    case "subscription.active":
    case "subscription.updated":
    case "subscription.uncanceled":
    case "subscription.canceled":
    case "subscription.revoked":
    case "subscription.past_due": {
      const subscription = normalizeSubscription(data);
      if (!subscription) {
        throw new PolarWebhookSkipError("Subscription payload was incomplete.");
      }
      await handleSubscription(subscription);
      return;
    }
    case "order.paid":
      await handleOrderPaid(data, true);
      return;
    case "order.updated": {
      const order = normalizeOrder(data);
      if (order?.paid) await handleOrderPaid(order, true);
      return;
    }
    default:
      return;
  }
}

export function isPolarCheckoutId(value: string | null | undefined): boolean {
  return Boolean(value && POLAR_UUID_RE.test(value));
}

function checkoutBelongsToUser(
  checkout: {
    externalCustomerId?: string | null;
    customerEmail?: string | null;
    metadata?: PolarMetadata;
    customerMetadata?: PolarMetadata;
  },
  user: User,
): boolean {
  const metadata = checkout.metadata ?? {};
  const customerMetadata = checkout.customerMetadata ?? {};
  const clerkUserId =
    asString(metadata.clerkUserId) ??
    asString(customerMetadata.clerkUserId) ??
    checkout.externalCustomerId ??
    null;
  const appUserId =
    asString(metadata.userId) ?? asString(customerMetadata.userId);

  if (clerkUserId && clerkUserId === user.clerkUserId) return true;
  if (appUserId && appUserId === user.id) return true;
  if (
    checkout.customerEmail &&
    checkout.customerEmail.toLowerCase() === user.email.toLowerCase() &&
    !clerkUserId
  ) {
    return true;
  }
  return false;
}

async function fulfillCheckoutRecord(
  checkout: {
    id: string;
    status: string;
    productId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    externalCustomerId?: string | null;
    customerEmail?: string | null;
    metadata?: PolarMetadata;
    customerMetadata?: PolarMetadata;
  },
  user: User,
): Promise<"applied" | "pending" | "rejected"> {
  if (!checkoutBelongsToUser(checkout, user)) return "rejected";
  if (checkout.status === "open" || checkout.status === "expired") return "pending";
  if (checkout.status === "failed") return "pending";

  const orders = await listPolarOrdersForCheckout(checkout.id);
  for (const order of orders) {
    try {
      await handleOrderPaid(order, true);
    } catch (error) {
      if (!(error instanceof PolarWebhookSkipError)) throw error;
    }
  }

  if (checkout.subscriptionId) {
    try {
      const { subscription } = await getPolarSubscription(checkout.subscriptionId);
      const normalized = normalizeSubscription(subscription);
      if (normalized) {
        try {
          await handleSubscription(normalized, undefined, {
            checkoutId: checkout.id,
            billingReason: "purchase",
          });
        } catch (error) {
          if (!(error instanceof PolarWebhookSkipError)) throw error;
        }
      }
    } catch (error) {
      console.error("[polar] Failed to load checkout subscription", {
        checkoutId: checkout.id,
        subscriptionId: checkout.subscriptionId,
        errorName: error instanceof Error ? error.name : "Error",
      });
    }
  }

  const account = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });
  if (account && account.plan !== "FREE") return "applied";

  if (checkout.status !== "succeeded" && checkout.status !== "confirmed") {
    return "pending";
  }

  const product = getBillingProductByProductId(checkout.productId);
  if (!product) return orders.length > 0 ? "applied" : "pending";

  if (product.kind === "subscription") {
    await applySubscriptionFromProduct({
      product,
      user,
      polarCustomerId: checkout.customerId ?? user.polarCustomerId ?? null,
      subscriptionId: checkout.subscriptionId ?? `checkout:${checkout.id}`,
      checkoutId: checkout.id,
    });
    return "applied";
  }

  if (product.kind === "topup" && orders.length === 0) {
    await grantCredits({
      userId: user.id,
      amount: product.credits,
      requestId: `polar:checkout:${checkout.id}:grant`,
      description: `${product.name} one-time credit top-up`,
    });
    return "applied";
  }

  return "applied";
}

export async function syncPolarCheckoutOnReturn(params: {
  user: User;
  checkoutId?: string | null;
  checkoutFlag?: string | null;
}): Promise<CheckoutNotice | null> {
  const { user, checkoutFlag } = params;
  const checkoutId = isPolarCheckoutId(params.checkoutId) ? params.checkoutId : null;
  const wantsSync = Boolean(checkoutId || checkoutFlag === "success");
  if (!wantsSync) return null;

  try {
    if (checkoutId) {
      const { checkout } = await getPolarCheckout(checkoutId);
      const result = await fulfillCheckoutRecord(checkout, user);
      if (result === "rejected") {
        return {
          tone: "error",
          message: "This payment does not belong to the signed-in account.",
        };
      }
      if (result === "pending") {
        return {
          tone: "pending",
          message:
            "Payment received. Your plan will update in a few seconds — refresh if it still looks unchanged.",
        };
      }
      return {
        tone: "success",
        message: "Payment confirmed. Your plan and credits are up to date.",
      };
    }

    const checkouts = await listRecentPaidCheckouts(user.clerkUserId);
    let applied = false;
    for (const checkout of checkouts) {
      const result = await fulfillCheckoutRecord(checkout, user);
      if (result === "applied") applied = true;
    }

    if (applied) {
      return {
        tone: "success",
        message: "Payment confirmed. Your plan and credits are up to date.",
      };
    }

    const current = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });
    if (current && current.plan !== "FREE") {
      return {
        tone: "success",
        message: "Payment confirmed. Your plan and credits are up to date.",
      };
    }

    return {
      tone: "pending",
      message:
        "Payment received. Your plan will update in a few seconds — refresh if it still looks unchanged.",
    };
  } catch (error) {
    console.error("[polar] checkout return sync failed", {
      errorName: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return {
      tone: "pending",
      message:
        "Payment received. If your plan does not update shortly, refresh this page or email support.",
    };
  }
}

export function planLabel(plan: PlanTier | string): string {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}
