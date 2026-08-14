import type { PlanTier } from "@prisma/client";

export type PlanConfig = {
  tier: PlanTier;
  label: string;
  monthlyPrice: number;
  /** 1 word = 1 credit. */
  monthlyCredits: number;
  maxWordsPerRequest: number;
};

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    tier: "FREE",
    label: "Free",
    monthlyPrice: 0,
    monthlyCredits: 500,
    maxWordsPerRequest: 500,
  },
  BASIC: {
    tier: "BASIC",
    label: "Basic",
    monthlyPrice: 5.99,
    monthlyCredits: 8_000,
    maxWordsPerRequest: 600,
  },
  PRO: {
    tier: "PRO",
    label: "Pro",
    monthlyPrice: 19.99,
    monthlyCredits: 40_000,
    maxWordsPerRequest: 2_000,
  },
  ULTRA: {
    tier: "ULTRA",
    label: "Ultra",
    monthlyPrice: 39.99,
    monthlyCredits: 90_000,
    maxWordsPerRequest: 3_000,
  },
};

export const DEFAULT_PLAN: PlanTier = "FREE";

export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLANS[tier] ?? PLANS[DEFAULT_PLAN];
}

/** Free accounts may spend their full 500-credit allotment in one request. */
export function resolveMaxWordsPerRequest(
  plan: PlanTier,
  storedMaxWordsPerRequest?: number | null,
): number {
  const config = getPlanConfig(plan);
  if (plan === "FREE") return config.maxWordsPerRequest;
  return storedMaxWordsPerRequest || config.maxWordsPerRequest;
}
