"use client";

import { Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getPromoOfferEndDate,
  getPromoTimeLeft,
  padCountdownUnit,
} from "@/lib/promo-offer";

function CountdownUnit({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[4.5rem] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center sm:min-w-[5.25rem] sm:px-4 sm:py-3.5">
      <p
        className={`text-2xl font-bold tabular-nums sm:text-3xl ${
          accent ? "text-accent-light" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>
    </div>
  );
}

export function PromoOfferBanner() {
  const offerEnds = useMemo(() => getPromoOfferEndDate(), []);

  const [timeLeft, setTimeLeft] = useState(() => getPromoTimeLeft(offerEnds));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getPromoTimeLeft(offerEnds));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [offerEnds]);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[#0a1713] px-5 py-6 shadow-[0_20px_60px_rgba(13,92,69,0.22)] sm:px-8 sm:py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent)_28%,transparent),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-px rounded-[1.75rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        aria-hidden
      />

      <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Limited time offer
          </span>

          <h2 className="mt-5 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl">
            GET{" "}
            <span className="bg-gradient-to-b from-accent-light to-accent bg-clip-text text-transparent">
              50%
            </span>
            <br />
            OFF
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-[15px] sm:leading-7">
            Join thousands of writers using RefinoText to revise AI-assisted
            drafts. Save on annual plans while this celebration offer lasts.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2.5 sm:justify-end sm:gap-3">
          <CountdownUnit value={padCountdownUnit(timeLeft.days)} label="Days" accent />
          <CountdownUnit value={padCountdownUnit(timeLeft.hours)} label="Hours" />
          <CountdownUnit value={padCountdownUnit(timeLeft.mins)} label="Mins" />
          <CountdownUnit value={padCountdownUnit(timeLeft.secs)} label="Secs" />
        </div>
      </div>
    </div>
  );
}
