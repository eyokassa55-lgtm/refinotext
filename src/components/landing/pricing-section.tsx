"use client";

import { useAuth } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { isClerkEnabled } from "@/lib/auth-config";
import {
  CREDIT_TOPUPS,
  PRICING_PLANS,
  type PricingPlan,
} from "@/lib/landing-data";
import { cn } from "@/lib/utils";

function formatUsPrice(amount: number) {
  return `US$${amount.toFixed(2)}`;
}

function monthlyEquivalent(yearlyPrice: number) {
  return (yearlyPrice / 12).toFixed(2);
}

export function PricingSection({
  headingLevel = "h2",
}: {
  headingLevel?: "h1" | "h2";
}) {
  if (!isClerkEnabled) {
    return <PricingSectionInner headingLevel={headingLevel} isSignedIn={false} />;
  }

  return <PricingSectionWithAuth headingLevel={headingLevel} />;
}

function PricingSectionWithAuth({
  headingLevel,
}: {
  headingLevel: "h1" | "h2";
}) {
  const { isSignedIn } = useAuth();
  return (
    <PricingSectionInner
      headingLevel={headingLevel}
      isSignedIn={Boolean(isSignedIn)}
    />
  );
}

function PricingSectionInner({
  headingLevel,
  isSignedIn,
}: {
  headingLevel: "h1" | "h2";
  isSignedIn: boolean;
}) {
  const [yearly, setYearly] = useState(false);
  const [loadingProductKey, setLoadingProductKey] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const paidPlans = useMemo(
    () => PRICING_PLANS.filter((plan) => !plan.isFree),
    [],
  );

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

  const TitleTag = headingLevel;

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-[#faf8f4] pt-6 pb-20 sm:pt-8 sm:pb-28"
    >
      <Container className="max-w-7xl">
        <div className="mb-8 flex items-center justify-center gap-4 sm:mb-10">
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Pricing plans
          </p>
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
        </div>

        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <TitleTag
            id="pricing-heading"
            className="text-3xl font-bold tracking-[-0.03em] sm:text-[2.65rem] sm:leading-[1.12]"
          >
            simple plans,{" "}
            <span className="font-display text-[1.08em] font-bold italic text-primary">
              honest
            </span>{" "}
            pricing
          </TitleTag>

          <p className="mx-auto mt-4 max-w-xl font-mono text-sm leading-6 text-muted sm:text-[15px]">
            {isSignedIn
              ? "Pick a tier that fits your writing volume. Upgrade or add a top-up anytime — no surprises."
              : "Pick a tier that fits your writing volume. Scale up or down anytime — no surprises."}
          </p>
        </div>

        <div className="mb-12 flex flex-col items-center gap-3">
          <div
            className="inline-flex max-w-full flex-wrap items-center justify-center rounded-full border border-border/80 bg-card p-1 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_8px_20px_rgba(13,92,69,0.08)]"
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
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  yearly
                    ? "bg-accent-light text-primary"
                    : "bg-accent/15 text-primary",
                )}
              >
                50% off
              </span>
            </button>
          </div>
          <p className="max-w-xl text-center text-sm text-muted">
            {yearly
              ? "Annual prices include 50% off every paid plan — billed once per year until cancelled."
              : "Monthly prices below are billed every month and renew each month until cancelled."}
          </p>
          {checkoutError && (
            <p className="text-sm font-medium text-red-700">{checkoutError}</p>
          )}
        </div>

        <div className="mx-auto grid max-w-5xl items-stretch gap-4 md:grid-cols-3 md:gap-5">
          {paidPlans.map((plan) => {
            const productKey = yearly
              ? plan.yearlyProductKey
              : plan.monthlyProductKey;
            const isOpening = Boolean(
              productKey && loadingProductKey === productKey,
            );
            const featured = Boolean(plan.featured);

            return (
              <article
                key={plan.name}
                className={cn(
                  "relative mx-auto flex w-full max-w-sm flex-col rounded-xl border px-4 pb-4 pt-6 md:mx-0 md:max-w-none sm:px-5 sm:pb-5 sm:pt-7",
                  featured
                    ? "z-10 border-primary bg-primary text-white shadow-[0_16px_40px_rgba(13,92,69,0.24)] md:-mt-1 md:mb-1"
                    : "border-border/80 bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,20,0.04)]",
                )}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-light px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-foreground">
                    Most popular
                  </span>
                )}

                <div className="text-center">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.2em]",
                      featured ? "text-white/75" : "text-muted",
                    )}
                  >
                    {plan.name}
                  </p>

                  <PlanPrice plan={plan} yearly={yearly} featured={featured} />

                  <p
                    className={cn(
                      "mx-auto mt-3 max-w-[14rem] text-xs leading-5",
                      featured ? "text-white/80" : "text-muted",
                    )}
                  >
                    {plan.description}
                  </p>

                  {!productKey ? (
                    <Button
                      href={plan.href}
                      className={cn(
                        "mt-4 w-full rounded-full py-2.5 text-xs font-bold",
                        featured
                          ? "bg-white text-primary hover:bg-white/90"
                          : "border border-border bg-transparent text-foreground hover:bg-mint-dark/40",
                      )}
                    >
                      {plan.cta}
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCheckout(productKey)}
                      disabled={Boolean(loadingProductKey)}
                      className={cn(
                        "mt-4 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                        featured
                          ? "bg-white text-primary hover:bg-white/90"
                          : "border border-border bg-transparent text-foreground hover:bg-mint-dark/40",
                      )}
                    >
                      {isOpening ? "Subscribing..." : plan.cta}
                    </button>
                  )}

                  <p
                    className={cn(
                      "mt-2 text-[10px]",
                      featured ? "text-white/65" : "text-muted",
                    )}
                  >
                    No hidden fees · Cancel anytime
                  </p>
                </div>

                <ul
                  className={cn(
                    "mt-4 flex-1 space-y-2 border-t pt-4 text-left",
                    featured ? "border-white/15" : "border-border/40",
                  )}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-start gap-2 text-xs leading-snug",
                        featured ? "text-white/92" : "text-foreground/90",
                      )}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          featured ? "text-accent-light" : "text-accent",
                        )}
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-accent/20 bg-accent-light/40 p-3 sm:mt-8 sm:p-4">
          <div className="flex flex-col gap-1 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                One-time top-ups
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                Extra credits without changing your plan
              </p>
            </div>
            <p className="text-[11px] leading-5 text-muted sm:max-w-xs sm:text-right">
              Billed once through Polar. Does not renew.
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-2.5">
            {CREDIT_TOPUPS.map((topup) => (
              <article
                key={topup.name}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5",
                  topup.featured ? "border-primary/70" : "border-border/70",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="truncate text-xs font-semibold text-foreground">
                      {topup.name}
                    </h4>
                    {topup.featured && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold text-primary-foreground">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {topup.credits.toLocaleString()} credits · {formatUsPrice(topup.price)}
                  </p>
                </div>

                <Button
                  onClick={() => startCheckout(topup.productKey)}
                  disabled={Boolean(loadingProductKey)}
                  variant={topup.featured ? "primary" : "secondary"}
                  size="sm"
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-[11px]",
                    topup.featured && "bg-primary hover:bg-primary-hover",
                  )}
                >
                  {loadingProductKey === topup.productKey ? "..." : "Buy"}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function PlanPrice({
  plan,
  yearly,
  featured = false,
}: {
  plan: PricingPlan;
  yearly: boolean;
  featured?: boolean;
}) {
  const mutedClass = featured ? "text-white/65" : "text-muted";
  const strikeClass = featured ? "text-white/55" : "text-muted";

  if (plan.isFree) {
    return (
      <div className="mt-4 flex items-baseline justify-center gap-1">
        <span className="text-4xl font-bold tracking-[-0.03em]">$0.00</span>
        <span className={cn("text-sm", mutedClass)}>/mo</span>
      </div>
    );
  }

  if (yearly) {
    return (
      <>
        <p className={cn("mt-3 text-xs line-through", strikeClass)}>
          {formatUsPrice(plan.monthlyPrice)}
        </p>
        <div className="mt-0.5 flex items-baseline justify-center gap-1">
          <span className="text-[1.85rem] font-bold leading-none tracking-[-0.03em] sm:text-[2rem]">
            {formatUsPrice(Number(monthlyEquivalent(plan.yearlyPrice)))}
          </span>
          <span className={cn("text-xs font-medium", mutedClass)}>/mo</span>
        </div>
        <p className={cn("mt-1.5 text-[10px]", mutedClass)}>
          Billed annually at {formatUsPrice(plan.yearlyPrice)}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mt-3 flex items-baseline justify-center gap-1">
        <span className="text-[1.85rem] font-bold leading-none tracking-[-0.03em] sm:text-[2rem]">
          {formatUsPrice(plan.monthlyPrice)}
        </span>
        <span className={cn("text-xs font-medium", mutedClass)}>/mo</span>
      </div>
      <p className={cn("mt-1.5 text-[10px]", mutedClass)}>Billed monthly</p>
    </>
  );
}
