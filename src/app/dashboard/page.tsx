import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Coins, FileText, Gauge } from "lucide-react";

import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";
import { getCreditBalance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUser } from "@/lib/users";

export const metadata: Metadata = {
  title: "Credits",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  GRANT: "Credits added",
  DEDUCTION: "Humanization",
  REFUND: "Refund",
};

export default async function DashboardPage() {
  if (!isClerkEnabled) {
    redirect(ROUTES.home);
  }

  const user = await ensureCurrentUser();
  if (!user) {
    redirect(ROUTES.signIn);
  }

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
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Your credits
        </h1>
        <p className="mt-2 text-sm text-muted">
          1 word = 1 credit. Credits are charged on the text you paste in, never
          on the output.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Coins className="h-4 w-4 text-accent" aria-hidden />
            Credits remaining
          </div>
          <p className="mt-3 text-3xl font-bold text-foreground">
            {account.balance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            of {account.monthlyCredits.toLocaleString()} included
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

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Gauge className="h-4 w-4 text-accent" aria-hidden />
            Current plan
          </div>
          <p className="mt-3 text-3xl font-bold text-foreground">
            {account.plan.charAt(0) + account.plan.slice(1).toLowerCase()}
          </p>
          <Link
            href={ROUTES.pricing}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Compare plans
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <FileText className="h-4 w-4 text-accent" aria-hidden />
            Per-request limit
          </div>
          <p className="mt-3 text-3xl font-bold text-foreground">
            {account.maxWordsPerRequest.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">words per humanization</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
