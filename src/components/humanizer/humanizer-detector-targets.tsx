"use client";

import { Info, Star } from "lucide-react";
import { useRef, useState } from "react";

import { isClerkEnabled } from "@/lib/auth-config";
import {
  DEFAULT_HUMANIZE_DETECTOR,
  type HumanizeDetectorId,
} from "@/lib/humanize-detectors";
import { cn } from "@/lib/utils";
import { DetectorModeTour } from "./detector-mode-tour";

const DETECTOR_TARGETS = [
  {
    id: "academic-turnitin",
    label: "Academic (Turnitin)",
    shortLabel: "Academic (Turnitin)",
    hint: "Rewrite in the academic gold-standard style for Turnitin",
  },
  {
    id: "gptzero",
    label: "GPTZero",
    shortLabel: "GPTZero",
    hint: "Rewrite in the gold-standard style for GPTZero",
  },
  {
    id: "zerogpt",
    label: "ZeroGPT",
    shortLabel: "ZeroGPT",
    hint: "Rewrite in the academic gold-standard style for ZeroGPT",
  },
] as const satisfies ReadonlyArray<{
  id: HumanizeDetectorId;
  label: string;
  shortLabel: string;
  hint: string;
}>;

type HumanizerDetectorTargetsProps = {
  value?: HumanizeDetectorId;
  onChange: (id: HumanizeDetectorId) => void;
};

export function HumanizerDetectorTargets({
  value = DEFAULT_HUMANIZE_DETECTOR,
  onChange,
}: HumanizerDetectorTargetsProps) {
  const chipRefs = useRef<Partial<Record<HumanizeDetectorId, HTMLButtonElement | null>>>({});
  const [tourDetector, setTourDetector] = useState<HumanizeDetectorId | null>(null);

  return (
    <>
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
          const isSelected = value === target.id;
          const isTouring = tourDetector === target.id;
          return (
            <button
              key={target.id}
              ref={(node) => {
                chipRefs.current[target.id] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Best for ${target.label}`}
              title={target.hint}
              onClick={() => onChange(target.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-tight transition-colors sm:px-3 sm:text-xs",
                isSelected
                  ? "border border-accent/35 bg-accent-light text-primary"
                  : "border border-border/80 bg-white text-muted hover:bg-mint-dark/70 hover:text-foreground",
                isTouring && "ring-2 ring-[#7c5cfc] ring-offset-2 ring-offset-white",
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
      {isClerkEnabled ? (
        <DetectorModeTour
          chipRefs={chipRefs}
          onSelect={onChange}
          onActiveDetectorChange={setTourDetector}
        />
      ) : null}
    </>
  );
}
