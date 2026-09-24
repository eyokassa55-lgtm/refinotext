"use client";

import { Sparkles } from "lucide-react";
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

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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

  const ring = [28, 56, 78, 99][scanned] ?? 99;
  const score = [74, 84, 93, 99][scanned] ?? 99;
  const ringOffset = RING_CIRCUMFERENCE * (1 - ring / 100);

  return (
    <div
      className="humanizer-write-motion pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      <div className="humanizer-write-aurora" />
      <div className="relative flex h-full flex-col px-6 py-6 sm:px-8 sm:py-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0F634A]/15 bg-[#0F634A]/6 px-2.5 py-1 text-[11px] font-semibold text-[#0F634A]">
            <span className="humanizer-attract-dot h-1.5 w-1.5 rounded-full bg-[#0F634A]" />
            Rewrite in motion
          </span>
          <span className="text-sm font-bold tracking-tight text-[#0F634A]">{score}% Human</span>
        </div>

        <div className="relative min-h-[9.5rem] overflow-hidden rounded-xl border border-[#0F634A]/10 bg-[#f6faf8] p-3.5">
          <div key={playId} className="humanizer-attract-scan" />
          <div className="relative z-[1] flex flex-col gap-2">
            {LINES.map((line, index) => {
              const isDone = index < scanned;
              const isHot = index === scanned - 1 && scanned < LINES.length;
              return (
                <p
                  key={`${playId}-${index}`}
                  className={cn(
                    "text-[13px] leading-6 tracking-tight transition-all duration-700",
                    isDone ? "text-[#1a2b25]" : "text-[#1a2b25]/40",
                    isHot && "humanizer-attract-hot px-1 py-0.5",
                  )}
                >
                  {isDone ? line.human : line.ai}
                </p>
              );
            })}
          </div>
          {scanned >= 2 ? (
            <div className="absolute right-3 top-4 z-[2] flex flex-col items-center">
              <span className="animate-fade-tooltip mb-1.5 rounded-full bg-[#111111] px-2 py-0.5 text-[10px] font-bold text-white">
                100% Human
              </span>
              <span className="animate-float-wand flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0F634A] shadow-[0_8px_20px_rgba(15,99,74,0.18)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(15,99,74,0.14)"
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="#0F634A"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-[11px] font-bold text-[#0F634A]">{ring}%</span>
          </div>
          <p className="text-sm font-medium text-[#1a2b25]/70">Turning stiff phrasing into a natural draft.</p>
        </div>
      </div>
    </div>
  );
}
