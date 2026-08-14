import "server-only";

import type { PlanTier, Prisma } from "@prisma/client";

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
  maxWordsPerRequest: number;
};

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

  return {
    userId,
    plan: user.subscription.plan,
    balance: user.creditBalance.balance,
    monthlyCredits: user.subscription.monthlyCredits,
    maxWordsPerRequest: resolveMaxWordsPerRequest(
      user.subscription.plan,
      user.subscription.maxWordsPerRequest,
    ),
  };
}

/**
 * Give a brand-new account its FREE plan and starting credits.
 * Safe to call repeatedly — existing records are left untouched.
 */
export async function provisionFreeTier(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!tx) {
    await prisma.$transaction((inner) => provisionFreeTier(userId, inner));
    return;
  }

  const plan = getPlanConfig("FREE");

  const existingBalance = await tx.creditBalance.findUnique({ where: { userId } });

  await tx.creditBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: plan.monthlyCredits },
  });

  if (!existingBalance) {
    await tx.creditTransaction.createMany({
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

  const existingSubscription = await tx.subscription.findUnique({
    where: { userId },
  });

  if (!existingSubscription) {
    await tx.subscription.create({
      data: {
        userId,
        plan: plan.tier,
        status: "ACTIVE",
        monthlyCredits: plan.monthlyCredits,
        maxWordsPerRequest: plan.maxWordsPerRequest,
      },
    });
  } else if (existingSubscription.plan === "FREE") {
    await tx.subscription.update({
      where: { userId },
      data: {
        maxWordsPerRequest: plan.maxWordsPerRequest,
      },
    });
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
