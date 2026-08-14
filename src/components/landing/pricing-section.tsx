"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import {
  CREDIT_TOPUPS,
  PRICING_PLANS,
  type PricingPlan,
} from "@/lib/landing-data";
import { cn } from "@/lib/utils";

function formatPrice(amount: number) {
  return amount.toFixed(2);
}

function getDisplayPrice(plan: PricingPlan, yearly: boolean) {
  if (plan.isFree) return "0.00";
  return formatPrice(yearly ? plan.yearlyPricePerMonth : plan.monthlyPrice);
}

function getOriginalPrice(plan: PricingPlan, yearly: boolean) {
  if (plan.isFree) return null;
  if (yearly) return formatPrice(plan.originalYearlyPricePerMonth);
  return formatPrice(plan.originalMonthlyPrice);
}

function getAnnualTotal(plan: PricingPlan, yearly: boolean) {
  if (plan.isFree || !yearly) return null;
  const total = plan.yearlyPricePerMonth * 12;
  const saved = plan.originalYearlyPricePerMonth * 12 - total;
  return {
    total: formatPrice(total),
    saved: formatPrice(saved),
  };
}

export function PricingSection() {
  const [yearly, setYearly] = useState(true);
  const [loadingProductKey, setLoadingProductKey] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = async (productKey: string) => {
    setCheckoutError(null);
    setLoadingProductKey(productKey);

    try {
      const res = await fetch("/api/checkout/polar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not open checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError("Could not open checkout. Please try again.");
    } finally {
      setLoadingProductKey(null);
    }
  };

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-card/60 py-20 sm:py-28"
    >
      <Container className="max-w-7xl">
        <SectionHeader
          id="pricing-heading"
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Start free and upgrade when you need more. No hidden fees, cancel anytime."
          className="mb-10"
        />

        <div className="mb-12 flex flex-col items-center gap-3">
          <div
            className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm"
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                !yearly
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
                yearly
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              Yearly billing
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Save 50%
              </span>
            </button>
          </div>
          {yearly && (
            <p className="text-sm font-medium text-primary">
              Save 50% per month with yearly billing
            </p>
          )}

          <div className="mt-2 flex flex-col items-center gap-1 rounded-2xl border border-accent/30 bg-accent-light px-5 py-3 text-center">
            <p className="text-sm font-semibold text-primary">
              1 word = 1 credit
            </p>
            <p className="text-xs text-muted">
              Credits are charged on the words you paste in, never on the length
              of the output. A 750-word draft costs 750 credits.
            </p>
          </div>
          {checkoutError && (
            <p className="text-sm font-medium text-red-700">{checkoutError}</p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => {
            const displayPrice = getDisplayPrice(plan, yearly);
            const originalPrice = getOriginalPrice(plan, yearly);
            const annual = getAnnualTotal(plan, yearly);
            const showStrike = yearly && !plan.isFree && originalPrice !== displayPrice;
            const productKey = yearly
              ? plan.yearlyProductKey
              : plan.monthlyProductKey;
            const isOpening = Boolean(
              productKey && loadingProductKey === productKey,
            );

            return (
              <article
                key={plan.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7",
                  plan.featured
                    ? "pricing-card-glow z-10 border-primary"
                    : "border-border transition-shadow hover:shadow-md",
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-[0_0_16px_color-mix(in_srgb,var(--accent)_45%,transparent)]">
                    Most popular
                  </span>
                )}

                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                    {plan.badge && (
                      <span className="rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {plan.description}
                  </p>

                  <div className="mt-4 flex items-baseline gap-2">
                    {showStrike && originalPrice && (
                      <span className="text-lg text-muted line-through">
                        ${originalPrice}
                      </span>
                    )}
                    <span className="text-4xl font-bold text-foreground">
                      ${displayPrice}
                    </span>
                    {!plan.isFree && (
                      <span className="text-sm text-muted">/mo</span>
                    )}
                  </div>

                  {plan.isFree ? (
                    <p className="mt-2 text-sm text-muted">Free forever</p>
                  ) : yearly ? (
                    <>
                      <p className="mt-2 text-sm text-muted">
                        per month (billed annually)
                      </p>
                      {annual && (
                        <p className="mt-1 text-xs text-muted">
                          ${annual.total}/year · save ${annual.saved}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">per month</p>
                  )}

                  <p className="mt-3 rounded-lg bg-mint-dark/40 px-3 py-2 text-xs font-medium text-foreground/80">
                    {plan.creditsPerMonth.toLocaleString()} credits / month ·{" "}
                    <span className="font-semibold text-primary">
                      1 word = 1 credit
                    </span>
                  </p>
                </div>

                {plan.isFree || !productKey ? (
                  <Button
                    href={plan.href}
                    variant={plan.featured ? "primary" : "secondary"}
                    className={cn(
                      "w-full rounded-xl py-3",
                      plan.featured && "bg-primary hover:bg-primary-hover",
                    )}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button
                    onClick={() => startCheckout(productKey)}
                    disabled={Boolean(loadingProductKey)}
                    variant={plan.featured ? "primary" : "secondary"}
                    className={cn(
                      "w-full rounded-xl py-3",
                      plan.featured && "bg-primary hover:bg-primary-hover",
                      !plan.featured &&
                        "border-accent/30 bg-accent-light text-primary hover:bg-accent/20",
                    )}
                  >
                    {isOpening ? "Opening checkout..." : plan.cta}
                  </Button>
                )}

                <p className="mt-3 text-center text-[11px] text-muted">
                  No hidden fees · Cancel anytime · Secure checkout
                </p>

                <ul className="mt-5 flex-1 space-y-3 border-t border-border pt-5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-foreground/90"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-light">
                        <Check className="h-3 w-3 text-primary" aria-hidden />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-3xl border border-accent/25 bg-accent-light/55 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              One-time top-ups
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Need more credits without changing your monthly plan?
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              Add extra credits once and keep your existing subscription. Top-up
              credits follow the same rule: 1 word = 1 credit.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {CREDIT_TOPUPS.map((topup) => (
              <article
                key={topup.name}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-sm",
                  topup.featured ? "border-primary" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {topup.name}
                    </h4>
                    <p className="mt-1 text-xs text-muted">
                      {topup.credits.toLocaleString()} extra credits
                    </p>
                  </div>
                  {topup.featured && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Popular
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    ${formatPrice(topup.price)}
                  </span>
                  <span className="pb-1 text-xs text-muted">one time</span>
                </div>

                <p className="mt-3 text-xs text-muted">
                  Up to {topup.maxWordsPerRequest.toLocaleString()} words per
                  request.
                </p>

                <Button
                  onClick={() => startCheckout(topup.productKey)}
                  disabled={Boolean(loadingProductKey)}
                  variant={topup.featured ? "primary" : "secondary"}
                  className={cn(
                    "mt-4 w-full rounded-xl py-2.5 text-sm",
                    topup.featured && "bg-primary hover:bg-primary-hover",
                  )}
                >
                  {loadingProductKey === topup.productKey
                    ? "Opening checkout..."
                    : "Buy top-up"}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
