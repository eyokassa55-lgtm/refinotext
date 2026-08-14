"use client";

import Link from "next/link";
import { Coins } from "lucide-react";

import { useCreditBalance } from "@/hooks/use-credit-balance";
import { ROUTES } from "@/lib/constants";

export function CreditNavBadge() {
  const { credits, loading } = useCreditBalance(true);

  if (loading && !credits) {
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-full border border-accent/20 bg-accent-light/50 px-2.5 text-[11px] text-muted">
        <Coins className="h-3 w-3 text-accent" aria-hidden />
        Credits
      </span>
    );
  }

  if (!credits) return null;

  return (
    <Link
      href={ROUTES.dashboard}
      title={`${credits.balance.toLocaleString()} credits remaining · 1 word = 1 credit`}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-accent/25 bg-accent-light/60 px-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Coins className="h-3 w-3" aria-hidden />
      {credits.balance.toLocaleString()}
    </Link>
  );
}
