import "server-only";

import type { PlanTier } from "@prisma/client";

export type BillingInterval = "month" | "year" | "one_time";
export type BillingKind = "subscription" | "topup";

export type BillingProduct = {
  key: string;
  productId: string;
  name: string;
  kind: BillingKind;
  tier: Exclude<PlanTier, "FREE">;
  interval: BillingInterval;
  credits: number;
  maxWordsPerRequest: number;
  price: number;
};

export const POLAR_PRODUCTS = {
  basic_monthly: {
    key: "basic_monthly",
    productId: "04111bf1-c98e-4892-8469-70d148e9be75",
    name: "Basic",
    kind: "subscription",
    tier: "BASIC",
    interval: "month",
    credits: 8_000,
    maxWordsPerRequest: 600,
    price: 5.99,
  },
  pro_monthly: {
    key: "pro_monthly",
    productId: "09e79099-6e23-472c-be09-6183b1447374",
    name: "Pro",
    kind: "subscription",
    tier: "PRO",
    interval: "month",
    credits: 40_000,
    maxWordsPerRequest: 2_000,
    price: 19.99,
  },
  ultra_monthly: {
    key: "ultra_monthly",
    productId: "1e9f065f-b7a0-464c-8faf-09af5506c09e",
    name: "Ultra",
    kind: "subscription",
    tier: "ULTRA",
    interval: "month",
    credits: 90_000,
    maxWordsPerRequest: 3_000,
    price: 39.99,
  },
  basic_yearly: {
    key: "basic_yearly",
    productId: "34f95e97-e208-47b2-9c07-1df713fcebc1",
    name: "Basic Yearly",
    kind: "subscription",
    tier: "BASIC",
    interval: "year",
    credits: 96_000,
    maxWordsPerRequest: 600,
    price: 35.88,
  },
  pro_yearly: {
    key: "pro_yearly",
    productId: "ec56c87b-e882-4016-a9b2-4e294dc2af57",
    name: "Pro Yearly",
    kind: "subscription",
    tier: "PRO",
    interval: "year",
    credits: 480_000,
    maxWordsPerRequest: 2_000,
    price: 119,
  },
  ultra_yearly: {
    key: "ultra_yearly",
    productId: "4e1009f9-5795-4b2b-937f-c688ccefa654",
    name: "Ultra Yearly",
    kind: "subscription",
    tier: "ULTRA",
    interval: "year",
    credits: 1_080_000,
    maxWordsPerRequest: 3_000,
    price: 239.88,
  },
  basic_topup: {
    key: "basic_topup",
    productId: "f5e4fdad-971b-463e-a589-ab5d46d25f51",
    name: "Basic Top-up",
    kind: "topup",
    tier: "BASIC",
    interval: "one_time",
    credits: 8_000,
    maxWordsPerRequest: 600,
    price: 5.99,
  },
  pro_topup: {
    key: "pro_topup",
    productId: "84ec06e7-1b52-492c-af9c-6aa3b324a381",
    name: "Pro Top-up",
    kind: "topup",
    tier: "PRO",
    interval: "one_time",
    credits: 40_000,
    maxWordsPerRequest: 2_000,
    price: 19.99,
  },
  ultra_topup: {
    key: "ultra_topup",
    productId: "ad287770-4aa4-4c32-8010-4c74386ffb14",
    name: "Ultra Top-up",
    kind: "topup",
    tier: "ULTRA",
    interval: "one_time",
    credits: 90_000,
    maxWordsPerRequest: 3_000,
    price: 39.99,
  },
} satisfies Record<string, BillingProduct>;

export type BillingProductKey = keyof typeof POLAR_PRODUCTS;

export function getBillingProduct(key: string): BillingProduct | null {
  return POLAR_PRODUCTS[key as BillingProductKey] ?? null;
}

export function getBillingProductByProductId(
  productId: string | null | undefined,
): BillingProduct | null {
  if (!productId) return null;
  return (
    Object.values(POLAR_PRODUCTS).find(
      (product) => product.productId === productId,
    ) ?? null
  );
}
