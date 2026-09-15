import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Coins, FileText, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";
import { getCreditBalance } from "@/lib/credits";
import { planLabel, syncPolarCheckoutOnReturn } from "@/lib/polar-fulfillment";
import { prisma } from "@/lib/prisma";
import { PAGE_SEO, pageMetadata } from "@/lib/seo";
import { ensureCurrentUser } from "@/lib/users";

export const metadata = pageMetadata(
  PAGE_SEO.dashboard.path,
  PAGE_SEO.dashboard.title,
  PAGE_SEO.dashboard.description,
  { index: false },
);

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  GRANT: "Credits added",
  DEDUCTION: "Humanization",
  REFUND: "Refund",
};

function firstSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isClerkEnabled) {
    redirect(ROUTES.home);
  }

  const user = await ensureCurrentUser();
  if (!user) {
    redirect(ROUTES.signIn);
  }

  const params = await searchParams;
  const checkoutNotice = await syncPolarCheckoutOnReturn({
    user,
    checkoutId:
      firstSearchParam(params.checkout_id) ??
      firstSearchParam(params.checkoutId),
    checkoutFlag: firstSearchParam(params.checkout),
  });

  const account = await getCreditBalance(user.id);
  if (!account) {
    redirect(ROUTES.home);
  }

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const used = Math.max(account.monthlyCredits - account.balance, 0);
  const usedPercent =
    account.monthlyCredits > 0
      ? Math.min(Math.round((used / account.monthlyCredits) * 100), 100)
      : 0;

  return (
    <div className="space-y-8">
      {checkoutNotice ? (
        <p
          className={
            checkoutNotice.tone === "error"
              ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : checkoutNotice.tone === "pending"
                ? "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                : "rounded-xl border border-primary/20 bg-accent-light/60 px-4 py-3 text-sm text-foreground"
          }
        >
          {checkoutNotice.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Your credits
          </h1>
          <p className="mt-2 text-sm text-muted">
            1 word = 1 credit. Credits are charged on the text you paste in, never
            on the output.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Paid subscriptions are billed by Polar, the merchant of record. They
            renew automatically until cancelled. To cancel, use Polar’s Customer
            Portal from Polar’s billing emails, or email{" "}
            <a
              className="font-medium text-primary underline-offset-2 hover:underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            . Recurring charges continue until you cancel.
          </p>
        </header>
        <Button href={ROUTES.humanizer} variant="secondary" className="shrink-0">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Humanize
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)]">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Coins className="h-4 w-4 text-accent" aria-hidden />
            Credits remaining
          </div>
          <p className="mt-3 text-3xl font-bold tracking-[-0.03em] text-foreground">
            {account.balance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            of {account.monthlyCredits.toLocaleString()} included{" "}
            {account.interval === "year" ? "this year" : "this month"}
          </p>
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-mint-dark/50"
            role="progressbar"
            aria-valuenow={usedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Monthly credit usage"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)]">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Gauge className="h-4 w-4 text-accent" aria-hidden />
            Current plan
          </div>
          <p className="mt-3 text-3xl font-bold tracking-[-0.03em] text-foreground">
            {planLabel(account.plan)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {account.interval === "year"
              ? "Billed annually"
              : account.plan === "FREE"
                ? "Free allotment"
                : "Billed monthly"}
          </p>
          <Link
            href={ROUTES.pricing}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Compare plans
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)]">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <FileText className="h-4 w-4 text-accent" aria-hidden />
            Per-request limit
          </div>
          <p className="mt-3 text-3xl font-bold tracking-[-0.03em] text-foreground">
            {account.maxWordsPerRequest.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">words per humanization</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)]">
        <h2 className="text-base font-semibold text-foreground">
          Recent credit activity
        </h2>

        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No credit activity yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {transactions.map((tx) => {
              const isCredit = tx.type !== "DEDUCTION";
              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {tx.description ??
                        (tx.wordCount ? `${tx.wordCount} words` : "—")}{" "}
                      · {tx.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={
                        isCredit
                          ? "text-sm font-semibold text-primary"
                          : "text-sm font-semibold text-foreground"
                      }
                    >
                      {isCredit ? "+" : "−"}
                      {tx.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted">
                      {tx.balanceAfter.toLocaleString()} left
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
