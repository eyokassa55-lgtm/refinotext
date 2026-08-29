"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import {
  CREDIT_TOPUPS,
  PRICING_PLANS,
  type PricingPlan,
} from "@/lib/landing-data";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";
import { cn } from "@/lib/utils";

function formatPrice(amount: number) {
  return amount.toFixed(2);
}

function monthlyEquivalent(yearlyPrice: number) {
  return formatPrice(yearlyPrice / 12);
}

export function PricingSection({
  headingLevel = "h2",
}: {
  headingLevel?: "h1" | "h2";
}) {
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
          titleAs={headingLevel}
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Start on the Free plan, then subscribe if you need more credits. Paid checkout is processed by Polar, the merchant of record."
          className="mb-10"
        />

        <div className="mb-12 flex flex-col items-center gap-3">
          <div
            className="inline-flex max-w-full flex-wrap items-center justify-center rounded-full border border-border bg-card p-1 shadow-sm"
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
              Annual billing
            </button>
          </div>
          <p className="max-w-xl text-center text-sm text-muted">
            {yearly
              ? "Annual prices below are billed once per year and renew each year until cancelled."
              : "Monthly prices below are billed every month and renew each month until cancelled."}
          </p>

          <div className="mt-2 flex flex-col items-center gap-1 rounded-2xl border border-accent/30 bg-accent-light px-5 py-3 text-center">
            <p className="text-sm font-semibold text-primary">1 word = 1 credit</p>
            <p className="text-xs text-muted">
              Credits are charged on the words you paste in, not on the length of
              the output. A 750-word draft costs 750 credits.
            </p>
          </div>
          {checkoutError && (
            <p className="text-sm font-medium text-red-700">{checkoutError}</p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => {
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
                  <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {plan.description}
                  </p>

                  <PlanPrice plan={plan} yearly={yearly} />

                  <p className="mt-3 rounded-lg bg-mint-dark/40 px-3 py-2 text-xs font-medium text-foreground/80">
                    {plan.creditsPerMonth.toLocaleString()} credits / month ·{" "}
                    <span className="font-semibold text-primary">1 word = 1 credit</span>
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
                    {isOpening ? "Opening Polar checkout..." : plan.cta}
                  </Button>
                )}

                <p className="mt-3 text-center text-[11px] text-muted">
                  {plan.isFree
                    ? "No credit card required for the Free plan"
                    : yearly
                      ? `$${formatPrice(plan.yearlyPrice)} billed once per year · renews annually until cancelled`
                      : `$${formatPrice(plan.monthlyPrice)} billed every month · renews monthly until cancelled`}
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

        <div className="mt-10 space-y-4 rounded-3xl border border-border bg-card p-5 text-sm leading-relaxed text-muted sm:p-6">
          <h3 className="text-base font-semibold text-foreground">
            Polar checkout, renewal, cancellation, and refunds
          </h3>
          <p>
            Polar is the merchant of record and reseller for RefinoText paid plans
            and credit top-ups. You complete payment on Polar’s checkout. RefinoText
            does not collect or store card details and does not process card
            payments.
          </p>
          <p>
            Subscriptions renew automatically at the chosen interval until you
            cancel. Recurring charges continue until cancelled. Cancel through
            Polar’s Customer Portal using the link in Polar’s purchase and billing
            emails, or email{" "}
            <a
              className="font-medium text-primary underline-offset-2 hover:underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            . Cancellation stops future renewals. You keep access until the end of
            the current billing period.
          </p>
          <p>
            Refund requests are reviewed by email and processed by Polar. Unused
            subscription time is not automatically refunded unless required by law
            or Polar issues a refund. See the{" "}
            <Link
              href={ROUTES.refunds}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Refunds and Cancellation Policy
            </Link>
            .
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-accent/25 bg-accent-light/55 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              One-time top-ups
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Need more credits without changing your subscription?
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              Top-ups are billed once through Polar. They do not renew. Credits
              follow the same rule: 1 word = 1 credit.
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
                  request. Does not renew.
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
                    ? "Opening Polar checkout..."
                    : "Buy top-up on Polar"}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function PlanPrice({ plan, yearly }: { plan: PricingPlan; yearly: boolean }) {
  if (plan.isFree) {
    return (
      <>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">$0.00</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Free plan · 500 credits each month · no paid subscription
        </p>
      </>
    );
  }

  if (yearly) {
    return (
      <>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">
            ${formatPrice(plan.yearlyPrice)}
          </span>
          <span className="text-sm text-muted">/year</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          billed once per year, about ${monthlyEquivalent(plan.yearlyPrice)}/month
        </p>
        <p className="mt-1 text-xs text-muted">
          12 monthly payments would be ${formatPrice(plan.monthlyPrice * 12)}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-foreground">
          ${formatPrice(plan.monthlyPrice)}
        </span>
        <span className="text-sm text-muted">/month</span>
      </div>
      <p className="mt-2 text-sm text-muted">billed every month</p>
      <p className="mt-1 text-xs text-muted">
        or ${formatPrice(plan.yearlyPrice)} billed once per year
      </p>
    </>
  );
}
