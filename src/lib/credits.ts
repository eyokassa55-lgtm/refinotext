import "server-only";

import type { PlanTier, Prisma, Subscription } from "@prisma/client";

import { getBillingProductByProductId } from "@/lib/billing";
import { getPlanConfig, resolveMaxWordsPerRequest } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { countWords } from "@/lib/words";

export { countWords };

export type CreditErrorCode =
  | "EMPTY_TEXT"
  | "OVER_REQUEST_LIMIT"
  | "INSUFFICIENT_CREDITS"
  | "NO_ACCOUNT";

export class CreditError extends Error {
  code: CreditErrorCode;
  details: Record<string, number | string>;

  constructor(
    code: CreditErrorCode,
    message: string,
    details: Record<string, number | string> = {},
  ) {
    super(message);
    this.name = "CreditError";
    this.code = code;
    this.details = details;
  }
}

export type CreditAccount = {
  userId: string;
  plan: PlanTier;
  balance: number;
  monthlyCredits: number;
  interval: string | null;
  maxWordsPerRequest: number;
};

/** Monthly or yearly word allotment for the live Polar product. */
export function subscriptionPeriodAllotment(account: {
  plan: PlanTier;
  monthlyCredits: number;
  interval?: string | null;
  polarProductId?: string | null;
}): number {
  const product = getBillingProductByProductId(account.polarProductId);
  if (product?.kind === "subscription") return product.credits;
  if (account.interval === "year") {
    return getPlanConfig(account.plan).monthlyCredits * 12;
  }
  return account.monthlyCredits;
}

async function syncPaidAllotment(account: Subscription): Promise<Subscription> {
  if (account.plan === "FREE") return account;
  const product = getBillingProductByProductId(account.polarProductId);
  const allotment = subscriptionPeriodAllotment(account);
  const interval = product?.interval ?? account.interval;
  const maxWords = product?.maxWordsPerRequest ?? account.maxWordsPerRequest;
  if (
    account.monthlyCredits === allotment &&
    account.interval === interval &&
    account.maxWordsPerRequest === maxWords
  ) {
    return account;
  }
  return prisma.subscription.update({
    where: { id: account.id },
    data: {
      monthlyCredits: allotment,
      interval,
      maxWordsPerRequest: maxWords,
    },
  });
}

function toCreditAccount(
  userId: string,
  subscription: Subscription,
  balance: number,
): CreditAccount {
  return {
    userId,
    plan: subscription.plan,
    balance,
    monthlyCredits: subscription.monthlyCredits,
    interval: subscription.interval,
    maxWordsPerRequest: resolveMaxWordsPerRequest(
      subscription.plan,
      subscription.maxWordsPerRequest,
    ),
  };
}

/** Idempotency keys are namespaced per user so one account cannot touch another's. */
export function buildRequestId(userId: string, clientKey: string): string {
  return `${userId}:${clientKey}`;
}

/**
 * Read the user's credit balance and plan limits.
 * Creates the FREE-tier records on first read so every account has a balance row.
 */
export async function getCreditBalance(
  userId: string,
): Promise<CreditAccount | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creditBalance: true, subscription: true },
  });

  if (!user) return null;

  if (!user.creditBalance || !user.subscription) {
    await provisionFreeTier(userId);
    return getCreditBalance(userId);
  }

  const subscription = await syncPaidAllotment(user.subscription);

  if (subscription.plan !== "FREE" && subscription.status === "ACTIVE") {
    const repaired = await reconcilePaidPlanCredits(userId);
    if (repaired) {
      const fresh = await prisma.creditBalance.findUnique({ where: { userId } });
      return toCreditAccount(
        userId,
        subscription,
        fresh?.balance ?? user.creditBalance.balance,
      );
    }
  }

  return toCreditAccount(userId, subscription, user.creditBalance.balance);
}

/**
 * Give a brand-new account its FREE plan and starting credits.
 * Safe to call repeatedly — existing records are left untouched.
 */
async function provisionFreeTierRecords(
  userId: string,
  db: Prisma.TransactionClient,
): Promise<void> {
  const plan = getPlanConfig("FREE");

  const existingBalance = await db.creditBalance.findUnique({ where: { userId } });

  await db.creditBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: plan.monthlyCredits },
  });

  if (!existingBalance) {
    await db.creditTransaction.createMany({
      data: [
        {
          userId,
          type: "GRANT",
          amount: plan.monthlyCredits,
          balanceAfter: plan.monthlyCredits,
          requestId: `${userId}:signup-grant`,
          description: "Free plan starting credits",
        },
      ],
      skipDuplicates: true,
    });
  }

  const existingSubscription = await db.subscription.findUnique({
    where: { userId },
  });

  if (!existingSubscription) {
    await db.subscription.create({
      data: {
        userId,
        plan: plan.tier,
        status: "ACTIVE",
        monthlyCredits: plan.monthlyCredits,
        maxWordsPerRequest: plan.maxWordsPerRequest,
      },
    });
  } else if (existingSubscription.plan === "FREE") {
    await db.subscription.update({
      where: { userId },
      data: {
        maxWordsPerRequest: plan.maxWordsPerRequest,
      },
    });
  }
}

/**
 * Give a brand-new account its FREE plan and starting credits.
 * Safe to call repeatedly — existing records are left untouched.
 */
export async function provisionFreeTier(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (tx) {
    await provisionFreeTierRecords(userId, tx);
    return;
  }

  try {
    await prisma.$transaction((inner) => provisionFreeTierRecords(userId, inner));
  } catch (error) {
    console.error(
      "[credits] interactive transaction failed; provisioning without a transaction",
      error,
    );
    await provisionFreeTierRecords(
      userId,
      prisma as unknown as Prisma.TransactionClient,
    );
  }
}

export type CreditCheck = {
  allowed: boolean;
  wordCount: number;
  requiredCredits: number;
  balance: number;
  maxWordsPerRequest: number;
  plan: PlanTier;
  error?: CreditError;
};

/**
 * Validate a request against plan limits and available credits.
 * Read-only: run this before calling Gemini.
 */
export async function checkCredits(
  userId: string,
  text: string,
): Promise<CreditCheck> {
  const account = await getCreditBalance(userId);

  if (!account) {
    throw new CreditError("NO_ACCOUNT", "No credit account found for this user.");
  }

  const wordCount = countWords(text);
  const base = {
    wordCount,
    requiredCredits: wordCount,
    balance: account.balance,
    maxWordsPerRequest: account.maxWordsPerRequest,
    plan: account.plan,
  };

  if (wordCount === 0) {
    return {
      ...base,
      allowed: false,
      error: new CreditError("EMPTY_TEXT", "Add some text before humanizing."),
    };
  }

  if (wordCount > account.maxWordsPerRequest) {
    return {
      ...base,
      allowed: false,
      error: new CreditError(
        "OVER_REQUEST_LIMIT",
        `Your ${account.plan} plan allows up to ${account.maxWordsPerRequest} words per request. This request is ${wordCount} words.`,
        { wordCount, maxWordsPerRequest: account.maxWordsPerRequest },
      ),
    };
  }

  if (wordCount > account.balance) {
    return {
      ...base,
      allowed: false,
      error: new CreditError(
        "INSUFFICIENT_CREDITS",
        `This request needs ${wordCount} credits but you have ${account.balance}.`,
        { required: wordCount, balance: account.balance },
      ),
    };
  }

  return { ...base, allowed: true };
}

export type ConsumeResult = {
  charged: number;
  balanceAfter: number;
  transactionId: string;
  duplicate: boolean;
};

/**
 * Atomically deduct 1 credit per input word.
 *
 * The guarded `updateMany` makes the balance check and the decrement a single
 * statement, so concurrent requests can never drive the balance below zero.
 * The unique (requestId, type) constraint makes retries idempotent.
 */
export async function consumeCredits(params: {
  userId: string;
  wordCount: number;
  requestId: string;
  description?: string;
}): Promise<ConsumeResult> {
  const { userId, wordCount, requestId, description } = params;

  if (wordCount <= 0) {
    throw new CreditError("EMPTY_TEXT", "Nothing to charge for.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "DEDUCTION" } },
    });

    if (existing) {
      return {
        charged: existing.amount,
        balanceAfter: existing.balanceAfter,
        transactionId: existing.id,
        duplicate: true,
      };
    }

    const updated = await tx.creditBalance.updateMany({
      where: { userId, balance: { gte: wordCount } },
      data: { balance: { decrement: wordCount } },
    });

    if (updated.count === 0) {
      const current = await tx.creditBalance.findUnique({ where: { userId } });
      throw new CreditError(
        "INSUFFICIENT_CREDITS",
        `This request needs ${wordCount} credits but you have ${current?.balance ?? 0}.`,
        { required: wordCount, balance: current?.balance ?? 0 },
      );
    }

    const balance = await tx.creditBalance.findUniqueOrThrow({
      where: { userId },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "DEDUCTION",
        amount: wordCount,
        balanceAfter: balance.balance,
        wordCount,
        requestId,
        description: description ?? "Humanization request",
      },
    });

    return {
      charged: wordCount,
      balanceAfter: balance.balance,
      transactionId: transaction.id,
      duplicate: false,
    };
  });
}

export type RefundResult = {
  refunded: number;
  balanceAfter: number;
  alreadyRefunded: boolean;
};

export type CreditGrantResult = {
  granted: number;
  balanceAfter: number;
  transactionId: string;
  duplicate: boolean;
};

export async function grantCredits(params: {
  userId: string;
  amount: number;
  requestId: string;
  description?: string;
}): Promise<CreditGrantResult> {
  const { userId, amount, requestId, description } = params;

  if (amount <= 0) {
    throw new CreditError("EMPTY_TEXT", "Credit grant amount must be positive.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "GRANT" } },
    });

    if (existing) {
      return {
        granted: existing.amount,
        balanceAfter: existing.balanceAfter,
        transactionId: existing.id,
        duplicate: true,
      };
    }

    await tx.creditBalance.upsert({
      where: { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount },
    });

    const balance = await tx.creditBalance.findUniqueOrThrow({
      where: { userId },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "GRANT",
        amount,
        balanceAfter: balance.balance,
        requestId,
        description: description ?? "Credit grant",
      },
    });

    return {
      granted: amount,
      balanceAfter: balance.balance,
      transactionId: transaction.id,
      duplicate: false,
    };
  });
}

const DUPLICATE_PLAN_GRANT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function subscriptionPeriodGrantRequestId(
  subscriptionId: string,
  currentPeriodStart: Date | null,
): string {
  const day = currentPeriodStart
    ? currentPeriodStart.toISOString().slice(0, 10)
    : "initial";
  return `polar:subscription:${subscriptionId}:period:${day}`;
}

function isTopUpGrant(description: string | null | undefined): boolean {
  return /top-up/i.test(description ?? "");
}

/**
 * Grant a paid plan's monthly/yearly allotment once per billing period.
 * Polar sends several events for one purchase; those must not stack.
 * Leftover Free credits are replaced by the paid allotment, not added to it.
 */
export async function grantSubscriptionPeriodCredits(params: {
  userId: string;
  amount: number;
  requestId: string;
  description: string;
  periodStart?: Date | null;
}): Promise<CreditGrantResult> {
  const { userId, amount, requestId, description, periodStart } = params;

  if (amount <= 0) {
    throw new CreditError("EMPTY_TEXT", "Credit grant amount must be positive.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "GRANT" } },
    });
    if (existing) {
      return {
        granted: existing.amount,
        balanceAfter: existing.balanceAfter,
        transactionId: existing.id,
        duplicate: true,
      };
    }

    const duplicateSince = new Date(Date.now() - DUPLICATE_PLAN_GRANT_WINDOW_MS);
    const recentSamePlanGrant = await tx.creditTransaction.findFirst({
      where: {
        userId,
        type: "GRANT",
        amount,
        description,
        createdAt: { gte: duplicateSince },
      },
      orderBy: { createdAt: "asc" },
    });
    if (recentSamePlanGrant) {
      return {
        granted: recentSamePlanGrant.amount,
        balanceAfter: recentSamePlanGrant.balanceAfter,
        transactionId: recentSamePlanGrant.id,
        duplicate: true,
      };
    }

    const since = periodStart ?? duplicateSince;
    const periodGrants = await tx.creditTransaction.findMany({
      where: {
        userId,
        type: "GRANT",
        createdAt: { gte: since },
      },
    });
    const topupTotal = periodGrants
      .filter((row) => isTopUpGrant(row.description))
      .reduce((sum, row) => sum + row.amount, 0);
    const targetBalance = amount + topupTotal;

    await tx.creditBalance.upsert({
      where: { userId },
      update: { balance: targetBalance },
      create: { userId, balance: targetBalance },
    });

    const balance = await tx.creditBalance.findUniqueOrThrow({
      where: { userId },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: "GRANT",
        amount,
        balanceAfter: balance.balance,
        requestId,
        description,
      },
    });

    return {
      granted: amount,
      balanceAfter: balance.balance,
      transactionId: transaction.id,
      duplicate: false,
    };
  });
}

/**
 * Undo stacked Polar grants so remaining credits match the paid allotment
 * plus top-ups, minus usage in the current period.
 */
export async function reconcilePaidPlanCredits(userId: string): Promise<boolean> {
  const [rawAccount, balanceRow] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.creditBalance.findUnique({ where: { userId } }),
  ]);
  if (!rawAccount || rawAccount.plan === "FREE" || rawAccount.status !== "ACTIVE" || !balanceRow) {
    return false;
  }

  const account = await syncPaidAllotment(rawAccount);
  const allotment = subscriptionPeriodAllotment(account);

  const periodStart = account.currentPeriodStart;
  const txs = await prisma.creditTransaction.findMany({
    where: {
      userId,
      createdAt: { gte: periodStart },
    },
  });

  const topups = txs
    .filter((row) => row.type === "GRANT" && isTopUpGrant(row.description))
    .reduce((sum, row) => sum + row.amount, 0);
  const deductions = txs
    .filter((row) => row.type === "DEDUCTION")
    .reduce((sum, row) => sum + row.amount, 0);
  const refunds = txs
    .filter(
      (row) =>
        row.type === "REFUND" &&
        !String(row.requestId).includes(":reconcile:"),
    )
    .reduce((sum, row) => sum + row.amount, 0);

  const expected = Math.max(0, allotment + topups - deductions + refunds);
  const extra = balanceRow.balance - expected;
  if (extra <= 0) return false;

  const requestId = `polar:reconcile:${userId}:${subscriptionPeriodGrantRequestId(
    account.polarSubscriptionId ?? account.id,
    periodStart,
  )}`;

  let changed = false;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "REFUND" } },
    });
    if (existing) return;

    const updated = await tx.creditBalance.updateMany({
      where: { userId, balance: { gte: extra } },
      data: { balance: { decrement: extra } },
    });
    if (updated.count === 0) return;

    const balance = await tx.creditBalance.findUniqueOrThrow({ where: { userId } });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "REFUND",
        amount: extra,
        balanceAfter: balance.balance,
        requestId,
        description: "Removed duplicate subscription credits",
      },
    });
    changed = true;
  });

  return changed;
}

/**
 * Return credits for a failed humanization.
 * Only refunds against a recorded deduction, and only once per request.
 */
export async function refundCredits(params: {
  userId: string;
  requestId: string;
  reason?: string;
}): Promise<RefundResult> {
  const { userId, requestId, reason } = params;

  return prisma.$transaction(async (tx) => {
    const deduction = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "DEDUCTION" } },
    });

    if (!deduction || deduction.userId !== userId) {
      const current = await tx.creditBalance.findUnique({ where: { userId } });
      return {
        refunded: 0,
        balanceAfter: current?.balance ?? 0,
        alreadyRefunded: false,
      };
    }

    const existingRefund = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "REFUND" } },
    });

    if (existingRefund) {
      return {
        refunded: 0,
        balanceAfter: existingRefund.balanceAfter,
        alreadyRefunded: true,
      };
    }

    const balance = await tx.creditBalance.update({
      where: { userId },
      data: { balance: { increment: deduction.amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "REFUND",
        amount: deduction.amount,
        balanceAfter: balance.balance,
        wordCount: deduction.wordCount,
        requestId,
        description: reason ?? "Refund for failed humanization",
      },
    });

    return {
      refunded: deduction.amount,
      balanceAfter: balance.balance,
      alreadyRefunded: false,
    };
  });
}

export type SavedHumanization = {
  id: string;
  output: string;
  wordCount: number;
  charged: number;
  balanceAfter: number;
  duplicate: boolean;
};

/**
 * Charge 1 credit per input word and persist the result in one transaction.
 * Must only be called after a successful humanization.
 */
export async function saveHumanizationAndCharge(params: {
  userId: string;
  requestId: string;
  wordCount: number;
  text: string;
  output: string;
  tone?: string | null;
  readability?: string | null;
  intensity?: number | null;
}): Promise<SavedHumanization> {
  const {
    userId,
    requestId,
    wordCount,
    text,
    output,
    tone,
    readability,
    intensity,
  } = params;

  if (wordCount <= 0) {
    throw new CreditError("EMPTY_TEXT", "Nothing to charge for.");
  }

  return prisma.$transaction(async (tx) => {
    const existingHumanization = await tx.humanization.findUnique({
      where: { requestId },
    });

    if (existingHumanization) {
      const balance = await tx.creditBalance.findUnique({ where: { userId } });
      return {
        id: existingHumanization.id,
        output: existingHumanization.outputText,
        wordCount: existingHumanization.inputWordCount,
        charged: 0,
        balanceAfter: balance?.balance ?? 0,
        duplicate: true,
      };
    }

    const existingDeduction = await tx.creditTransaction.findUnique({
      where: { requestId_type: { requestId, type: "DEDUCTION" } },
    });

    let charged = 0;
    let balanceAfter: number;

    if (existingDeduction) {
      balanceAfter = existingDeduction.balanceAfter;
    } else {
      const updated = await tx.creditBalance.updateMany({
        where: { userId, balance: { gte: wordCount } },
        data: { balance: { decrement: wordCount } },
      });

      if (updated.count === 0) {
        const current = await tx.creditBalance.findUnique({ where: { userId } });
        throw new CreditError(
          "INSUFFICIENT_CREDITS",
          `This request needs ${wordCount} credits but you have ${current?.balance ?? 0}.`,
          { required: wordCount, balance: current?.balance ?? 0 },
        );
      }

      const balance = await tx.creditBalance.findUniqueOrThrow({
        where: { userId },
      });
      balanceAfter = balance.balance;
      charged = wordCount;

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "DEDUCTION",
          amount: wordCount,
          balanceAfter,
          wordCount,
          requestId,
          description: `Humanization · ${wordCount} words`,
        },
      });
    }

    const saved = await tx.humanization.create({
      data: {
        userId,
        requestId,
        inputWordCount: wordCount,
        creditsCharged: existingDeduction?.amount ?? wordCount,
        tone: tone ?? null,
        readability: readability ?? null,
        intensity: intensity ?? null,
        inputText: text,
        outputText: output,
      },
    });

    return {
      id: saved.id,
      output: saved.outputText,
      wordCount: saved.inputWordCount,
      charged,
      balanceAfter,
      duplicate: Boolean(existingDeduction),
    };
  });
}
