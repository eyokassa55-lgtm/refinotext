"use client";

import { Info, Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const DETECTOR_TARGETS = [
  {
    id: "academic-turnitin",
    label: "Academic (Turnitin)",
    shortLabel: "Academic (Turnitin)",
    hint: "Best for academic drafts checked with Turnitin",
  },
  {
    id: "gptzero",
    label: "GPTZero",
    shortLabel: "GPTZero",
    hint: "Best for drafts checked with GPTZero",
  },
  {
    id: "zerogpt",
    label: "ZeroGPT",
    shortLabel: "ZeroGPT",
    hint: "Best for drafts checked with ZeroGPT",
  },
] as const;

type DetectorTargetId = (typeof DETECTOR_TARGETS)[number]["id"];

export function HumanizerDetectorTargets() {
  const [selected, setSelected] = useState<DetectorTargetId>("academic-turnitin");

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-1"
      role="radiogroup"
      aria-label="Best for detector"
    >
      <p className="shrink-0 text-[10px] font-semibold leading-tight text-muted">
        Best
        <br className="hidden sm:block" />
        <span className="sm:hidden"> </span>
        for:
      </p>

      {DETECTOR_TARGETS.map((target) => {
        const isSelected = selected === target.id;
        return (
          <button
            key={target.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Best for ${target.label}`}
            title={target.hint}
            onClick={() => setSelected(target.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-tight transition-colors sm:px-3 sm:text-xs",
              isSelected
                ? "border border-accent/35 bg-accent-light text-primary"
                : "border border-border/80 bg-white text-muted hover:bg-mint-dark/70 hover:text-foreground",
            )}
          >
            <span className="max-w-[7.25rem] truncate sm:max-w-none">{target.shortLabel}</span>
            {isSelected ? (
              <Star className="h-3 w-3 fill-accent text-accent" aria-hidden />
            ) : null}
            <Info className="h-3 w-3 opacity-70" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
