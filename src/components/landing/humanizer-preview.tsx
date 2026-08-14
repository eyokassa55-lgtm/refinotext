"use client";

import {
  Bot,
  CheckCircle2,
  RotateCcw,
  ScanSearch,
  Sparkles,
  UserCheck,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const AI_DRAFT =
  "Furthermore, it is imperative to analyze the data systematically. Consequently, this study demonstrates significant statistical correlations across multiple key parameters.";

const HUMAN_TONE =
  "When you look closely at the numbers, a clear pattern emerges. The results show real, meaningful connections across every key area we measured.";

const HIGHLIGHT_WORDS = ["numbers", "pattern", "meaningful", "connections"];

export function HumanizerPreview() {
  const [viewMode, setViewMode] = useState<"transform" | "compare">("transform");
  const [stage, setScanningStage] = useState<"scanning" | "rewriting" | "complete">("scanning");
  const [progress, setProgress] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState(0);
  const [key, setKey] = useState(0);

  const startAnimation = useCallback(() => {
    setScanningStage("scanning");
    setProgress(12);
    setActiveWordIdx(0);

    const progressTimer = setTimeout(() => {
      setProgress(68);
      setScanningStage("rewriting");
    }, 1200);

    const wordInterval = setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % HIGHLIGHT_WORDS.length);
    }, 700);

    const completeTimer = setTimeout(() => {
      setProgress(99);
      setScanningStage("complete");
      clearInterval(wordInterval);
    }, 2500);

    return () => {
      clearTimeout(progressTimer);
      clearInterval(wordInterval);
      clearTimeout(completeTimer);
    };
  }, []);

  useEffect(() => {
    const cleanup = startAnimation();
    return cleanup;
  }, [startAnimation, key]);

  const handleReplay = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div
      className="relative w-full max-w-lg"
      aria-label="AI Draft to Human Tone Transformation Preview"
    >
      {/* Background Ambient Glow */}
      <div
        className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-accent/20 via-primary/10 to-accent/20 blur-xl"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0e1311] text-white shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3.5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <ScanSearch className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Refino Engine v1.0</p>
              <p className="text-[10px] text-white/50">Qualitative Motion Transform</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("transform")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
                viewMode === "transform"
                  ? "bg-accent text-white shadow-sm"
                  : "text-white/60 hover:text-white",
              )}
            >
              Motion Scan
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
                viewMode === "compare"
                  ? "bg-accent text-white shadow-sm"
                  : "text-white/60 hover:text-white",
              )}
            >
              Before / After
            </button>
          </div>
        </div>

        {/* Card Body */}
        {viewMode === "transform" ? (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Status Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stage === "scanning" && (
                  <Badge variant="dark" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                    <Bot className="h-3 w-3 animate-pulse" />
                    Detecting AI Cadence...
                  </Badge>
                )}
                {stage === "rewriting" && (
                  <Badge variant="dark" className="bg-primary/20 text-accent border-accent/30">
                    <Wand2 className="h-3 w-3 animate-spin" />
                    Humanizing Tone &amp; Rhythm...
                  </Badge>
                )}
                {stage === "complete" && (
                  <Badge variant="dark" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    <UserCheck className="h-3 w-3 text-emerald-400" />
                    100% Authentic Human Tone
                  </Badge>
                )}
              </div>

              <span className="text-[11px] font-mono text-white/50">
                {stage === "scanning" ? "Raw Draft" : "Passed Turnitin &amp; GPTZero"}
              </span>
            </div>

            {/* Transforming Text Area */}
            <div className="relative min-h-[120px] rounded-xl border border-white/10 bg-black/40 p-4 font-sans text-sm leading-relaxed text-white/90">
              {/* Glowing Scan Line Animation */}
              {stage !== "complete" && (
                <div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_12px_var(--color-accent)] transition-all duration-700 animate-scan-pulse"
                  style={{ top: `${(progress / 100) * 100}%` }}
                />
              )}

              {stage === "scanning" ? (
                <p className="text-white/60 italic font-mono transition-opacity">
                  &ldquo;{AI_DRAFT}&rdquo;
                </p>
              ) : (
                <p className="transition-all duration-500">
                  {HUMAN_TONE.split(/(\s+)/).map((segment, idx) => {
                    const clean = segment.replace(/[.,]/g, "").toLowerCase();
                    const isTarget = clean === HIGHLIGHT_WORDS[activeWordIdx];

                    if (isTarget) {
                      return (
                        <span key={idx} className="relative inline-block">
                          <span className="rounded bg-accent/30 px-1 font-semibold text-accent animate-scan-pulse">
                            {segment}
                          </span>
                          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-0.5 text-[9px] font-bold text-black shadow-md animate-fade-tooltip">
                            <Sparkles className="inline h-2.5 w-2.5 text-accent mr-0.5" />
                            Burstiness Enhanced
                          </span>
                        </span>
                      );
                    }
                    return <span key={idx}>{segment}</span>;
                  })}
                </p>
              )}
            </div>

            {/* Score Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-white/70">Human Probability Score</span>
                <span className="text-accent font-mono font-bold">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-primary to-accent transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Before vs After Compare Mode */
          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-red-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Bot className="h-3.5 w-3.5" /> AI Draft
                  </span>
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px]">
                    88% Flagged
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed font-mono">
                  {AI_DRAFT}
                </p>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-accent font-semibold">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Humanized
                  </span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    99.8% Bypass
                  </span>
                </div>
                <p className="text-xs text-white/90 leading-relaxed font-sans">
                  {HUMAN_TONE}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3.5 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Organic Sentence Flow</span>
          </div>

          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/80 hover:border-accent hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Replay Motion
          </button>
        </div>
      </div>
    </div>
  );
}
