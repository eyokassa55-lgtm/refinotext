"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const LINES = [
  {
    ai: "Furthermore, it is imperative to analyze the data systematically.",
    human: "When you look closely at the numbers, a clear pattern shows up.",
  },
  {
    ai: "Consequently, this study demonstrates significant statistical correlations.",
    human: "The results point to real, meaningful connections.",
  },
  {
    ai: "Therefore, it is essential to consider the implications of these findings.",
    human: "In short, the data holds up across every key area we measured.",
  },
] as const;

export function HumanizerOutputMotion() {
  const [scanned, setScanned] = useState(0);
  const [playId, setPlayId] = useState(0);

  useEffect(() => {
    setScanned(0);
    const timers = [
      window.setTimeout(() => setScanned(1), 700),
      window.setTimeout(() => setScanned(2), 1500),
      window.setTimeout(() => setScanned(3), 2300),
      window.setTimeout(() => setPlayId((current) => current + 1), 4200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [playId]);

  const score = [74, 84, 93, 99][scanned] ?? 99;

  return (
    <div
      className="humanizer-write-motion pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      <div className="relative flex h-full flex-col px-6 py-6 sm:px-8 sm:py-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0F634A]/15 bg-[#0F634A]/6 px-2.5 py-1 text-[11px] font-semibold text-[#0F634A]">
            <span className="humanizer-attract-dot h-1.5 w-1.5 rounded-full bg-[#0F634A]" />
            Rewrite in motion
          </span>
          <span className="text-sm font-bold tracking-tight text-[#0F634A]">{score}% Human</span>
        </div>

        <div className="relative min-h-[9.5rem] overflow-hidden rounded-xl border border-[#0F634A]/10 bg-[#f6faf8] p-3.5">
          <div className="relative z-[1] flex flex-col gap-2">
            {LINES.map((line, index) => {
              const isDone = index < scanned;
              return (
                <p
                  key={`${playId}-${index}`}
                  className={cn(
                    "text-[13px] leading-6 tracking-tight transition-all duration-700",
                    isDone ? "text-[#1a2b25]" : "text-[#1a2b25]/40",
                  )}
                >
                  {isDone ? line.human : line.ai}
                </p>
              );
            })}
          </div>
        </div>

        <p className="mt-auto pt-4 text-sm font-medium text-[#1a2b25]/70">
          Turning stiff phrasing into a natural draft.
        </p>
      </div>
    </div>
  );
}
