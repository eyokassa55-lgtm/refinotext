"use client";

import {
  BookOpen,
  Brain,
  Briefcase,
  Coffee,
  Gauge,
  GraduationCap,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { Show } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";
import { READABILITY_LEVELS, TONE_MODES } from "@/lib/landing-data";
import { getIntensityLabel } from "@/lib/humanizer";
import { cn } from "@/lib/utils";

const toneIcons = {
  brain: Brain,
  graduation: GraduationCap,
  coffee: Coffee,
  briefcase: Briefcase,
};

type HumanizerControlsProps = {
  tone: string;
  onToneChange: (tone: string) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
  readability: string;
  onReadabilityChange: (value: string) => void;
  onRefine: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export function HumanizerControls({
  tone,
  onToneChange,
  intensity,
  onIntensityChange,
  readability,
  onReadabilityChange,
  onRefine,
  isLoading,
  disabled,
}: HumanizerControlsProps) {
  const intensityName = getIntensityLabel(intensity);

  return (
    <div
      className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
      aria-label="Humanizer settings"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
        {/* Tone Mode */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            <SlidersHorizontal className="h-3 w-3 text-accent" aria-hidden />
            Tone
          </span>
          <div className="flex flex-wrap gap-1">
            {TONE_MODES.map((mode) => {
              const Icon = toneIcons[mode.icon];
              const isActive = tone === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onToneChange(mode.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-foreground text-primary-foreground"
                      : "bg-mint-dark/70 text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{mode.label}</span>
                  <span className="sm:hidden">{mode.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden h-4 w-px bg-border lg:block" aria-hidden />

        {/* Readability */}
        <div className="flex items-center gap-2 lg:w-44">
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            <BookOpen className="h-3 w-3 text-accent" aria-hidden />
            Level
          </span>
          <label htmlFor="readability-select" className="sr-only">
            Target readability
          </label>
          <select
            id="readability-select"
            value={readability}
            onChange={(event) => onReadabilityChange(event.target.value)}
            className="min-w-0 flex-1 appearance-none truncate rounded-lg border border-border bg-mint-dark/50 bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%234a5c55%27 stroke-width=%272%27%3E%3Cpath d=%27m3 4.5 3 3 3-3%27/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat px-2 py-1 pr-7 text-[11px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {READABILITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden h-4 w-px bg-border lg:block" aria-hidden />

        {/* Intensity — inline on desktop */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[220px]">
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            <Gauge className="h-3 w-3 text-accent" aria-hidden />
            <span className="hidden sm:inline">Intensity</span>
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor="intensity-slider" className="sr-only">
              Humanize intensity: {intensityName} ({intensity}%)
            </label>
            <input
              id="intensity-slider"
              type="range"
              min={0}
              max={100}
              value={intensity}
              onChange={(event) => onIntensityChange(Number(event.target.value))}
              className="intensity-slider intensity-slider-sm w-full"
              style={{ ["--intensity" as string]: `${intensity}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] font-medium text-primary">
            {intensity}%
          </span>
        </div>

        {/* Humanize button */}
        {isClerkEnabled ? (
          <>
            <Show when="signed-out">
              <Button
                href={ROUTES.signIn}
                className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:ml-auto lg:w-auto"
                size="sm"
                ariaLabel="Sign in to humanize"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Sign in to Humanize
              </Button>
            </Show>
            <Show when="signed-in">
              <Button
                onClick={onRefine}
                disabled={disabled || isLoading}
                className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:ml-auto lg:w-auto"
                size="sm"
                ariaLabel="Humanize text now"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                )}
                {isLoading ? "Humanizing..." : "Humanize"}
              </Button>
            </Show>
          </>
        ) : (
          <Button
            onClick={onRefine}
            disabled={disabled || isLoading}
            className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:ml-auto lg:w-auto"
            size="sm"
            ariaLabel="Humanize text now"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {isLoading ? "Humanizing..." : "Humanize"}
          </Button>
        )}
      </div>
    </div>
  );
}
