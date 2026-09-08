"use client";

import { Tag, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/ui/container";
import {
  formatPromoCountdown,
  getPromoOfferEndDate,
  getPromoTimeLeft,
} from "@/lib/promo-offer";
import { ROUTES } from "@/lib/constants";

export function AnnouncementBar() {
  const offerEnds = useMemo(() => getPromoOfferEndDate(), []);
  const [countdown, setCountdown] = useState(() =>
    formatPromoCountdown(getPromoTimeLeft(offerEnds)),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatPromoCountdown(getPromoTimeLeft(offerEnds)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [offerEnds]);

  return (
    <div className="relative overflow-x-clip bg-gradient-to-r from-[#083528] via-primary to-[#083528]">
      <Container className="flex min-h-[38px] min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-xs text-white sm:gap-x-4 sm:text-sm">
        <span className="inline-flex items-center gap-1.5 font-bold tracking-tight">
          <Tag className="h-3.5 w-3.5 shrink-0 text-accent-light" aria-hidden />
          50% OFF
        </span>

        <span className="hidden h-3 w-px bg-white/25 sm:block" aria-hidden />

        <span className="inline-flex items-center gap-1.5 tabular-nums text-white/90">
          <Timer className="h-3.5 w-3.5 shrink-0 text-accent-light" aria-hidden />
          {countdown}
        </span>

        <span className="hidden h-3 w-px bg-white/25 sm:block" aria-hidden />

        <Link
          href={ROUTES.pricing}
          className="font-medium text-white underline decoration-white/50 underline-offset-[3px] transition-colors hover:text-accent-light hover:decoration-accent-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light rounded-sm"
        >
          Claim offer
        </Link>
      </Container>
    </div>
  );
}
