"use client";

import { RotateCcw, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const SLIDES = [
  {
    chunks: [
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
    ],
  },
  {
    chunks: [
      {
        ai: "Research indicates that regular physical activity is beneficial.",
        human: "Research shows that staying active helps the mind stay sharp.",
      },
      {
        ai: "It is widely acknowledged that exercise enhances cognitive performance.",
        human: "A daily walk can boost focus and memory over time.",
      },
      {
        ai: "Thus, individuals are advised to maintain consistent engagement.",
        human: "Keep it simple: move a little, often, and stick with it.",
      },
    ],
  },
  {
    chunks: [
      {
        ai: "It is important to note that the draft requires substantial revision.",
        human: "This draft is easier to read once the stiff phrasing is gone.",
      },
      {
        ai: "The current iteration utilizes overly formal constructions.",
        human: "The meaning stays the same. The voice just sounds more natural.",
      },
      {
        ai: "Overall, the output will be optimized for human-like expression.",
        human: "Read it out loud. If it sounds like you, you are close.",
      },
    ],
  },
] as const;

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreTone(value: number) {
  const t = Math.min(1, Math.max(0, (value - 68) / 31));
  const r = Math.round(224 + (78 - 224) * t);
  const g = Math.round(82 + (240 - 82) * t);
  const b = Math.round(74 + (195 - 74) * t);
  const a = 0.4 + 0.6 * t;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function HumanizerPreview() {
  const [slide, setSlide] = useState(0);
  const [playId, setPlayId] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [showWand, setShowWand] = useState(false);
  const [ring, setRing] = useState(24);
  const [score, setScore] = useState(72);

  const replay = useCallback(() => {
    setPlayId((current) => current + 1);
  }, []);

  useEffect(() => {
    setScanned(0);
    setShowWand(false);
    setRing(24);
    setScore(72);

    const timers = [
      window.setTimeout(() => setScanned(1), 750),
      window.setTimeout(() => {
        setScanned(2);
        setShowWand(true);
      }, 1700),
      window.setTimeout(() => setScanned(3), 2650),
    ];

    const tick = window.setInterval(() => {
      setRing((current) => Math.min(99, current + 1));
      setScore((current) => Math.min(99, current + 1));
    }, 110);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(tick);
    };
  }, [playId, slide]);

  const ringOffset = RING_CIRCUMFERENCE * (1 - ring / 100);
  const current = SLIDES[slide];
  const tone = scoreTone(score);
  const ringTone = scoreTone(ring);

  return (
    <div
      className="relative w-full min-w-0 max-w-lg"
      aria-label="Example rewrite motion preview"
    >
      <div className="pointer-events-none absolute -inset-10" aria-hidden>
        <div className="preview-aurora preview-aurora-a" />
        <div className="preview-aurora preview-aurora-b" />
        <div className="preview-aurora preview-aurora-c" />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0e1311] text-white shadow-[0_24px_70px_rgba(13,92,69,0.28)]">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 sm:px-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white/70">
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Deep Scan
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <span className="preview-status-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Rewrite in motion
          </span>
        </div>

        <div className="relative mx-4 mt-3 min-h-[168px] overflow-hidden rounded-xl border border-white/10 bg-black/45 p-3.5 sm:mx-5">
          <div key={playId} className="preview-scan-beam" aria-hidden />

          <div className="relative z-[1] flex flex-col gap-1.5">
            {current.chunks.map((chunk, index) => {
              const isDone = index < scanned;
              const isHot = index === scanned - 1 && scanned < current.chunks.length;

              return (
                <p
                  key={`${slide}-${playId}-${index}`}
                  className={cn(
                    "transition-all duration-700",
                    isDone
                      ? "font-display text-[1.05rem] leading-6 text-white"
                      : "font-mono text-[11.5px] italic leading-5 tracking-wide text-white/45",
                    isHot && "preview-hot-word preview-hot-word-active px-1 py-0.5",
                  )}
                >
                  {isDone ? chunk.human : chunk.ai}
                </p>
              );
            })}
          </div>

          {showWand ? (
            <div className="pointer-events-none absolute right-4 top-6 z-[2] flex flex-col items-center">
              <span className="animate-fade-tooltip mb-1.5 rounded-full bg-black/90 px-2 py-0.5 text-[10px] font-bold tracking-tight text-white shadow-lg">
                100% Human!
              </span>
              <span className="animate-float-wand flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
              aria-hidden
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={ringTone}
                strokeOpacity={0.22}
                strokeWidth={RING_STROKE}
                className="transition-[stroke] duration-300 ease-out"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={ringTone}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className="transition-[stroke,stroke-dashoffset] duration-300 ease-out"
              />
            </svg>
            <span
              className="absolute text-xs font-bold transition-colors duration-300"
              style={{ color: ringTone }}
            >
              {ring}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-lg font-bold tracking-tight transition-colors duration-300 sm:text-xl"
              style={{ color: tone }}
            >
              {score}% Human
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              Example rewrite preview
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/85 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Replay Motion
            </button>
            <div
              className="flex items-center gap-1.5"
              role="tablist"
              aria-label="Preview examples"
            >
              {SLIDES.map((_, index) => {
                const selected = slide === index;
                return (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`Example ${index + 1}`}
                    onClick={() => {
                      setSlide(index);
                      setPlayId((current) => current + 1);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      selected
                        ? "w-5 bg-white"
                        : "w-1.5 bg-white/30 hover:bg-white/50",
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
