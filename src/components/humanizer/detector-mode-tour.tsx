"use client";

import { useUser } from "@clerk/nextjs";
import { Droplets, GraduationCap, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import {
  DETECTOR_TOUR_STEPS,
  DETECTOR_TOUR_WELCOME_PARAM,
  hasCompletedDetectorTour,
  markDetectorTourComplete,
  shouldStartDetectorTour,
  stripWelcomeParamFromUrl,
  type DetectorTourStep,
} from "@/lib/detector-tour";
import type { HumanizeDetectorId } from "@/lib/humanize-detectors";
import { cn } from "@/lib/utils";

const STEP_ICONS = {
  "academic-turnitin": GraduationCap,
  gptzero: Sparkles,
  zerogpt: Droplets,
} as const;

type ChipRefs = RefObject<Partial<Record<HumanizeDetectorId, HTMLButtonElement | null>>>;

type DetectorModeTourProps = {
  chipRefs: ChipRefs;
  onSelect: (id: HumanizeDetectorId) => void;
  onActiveDetectorChange: (id: HumanizeDetectorId | null) => void;
};

export function DetectorModeTour({
  chipRefs,
  onSelect,
  onActiveDetectorChange,
}: DetectorModeTourProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const startedRef = useRef(false);

  const finish = useCallback(() => {
    markDetectorTourComplete(window.localStorage);
    setStepIndex(null);
    onActiveDetectorChange(null);
  }, [onActiveDetectorChange]);

  useEffect(() => {
    if (!isLoaded || startedRef.current) return;
    if (!isSignedIn) return;
    if (hasCompletedDetectorTour(window.localStorage)) return;

    const welcomeParam = new URLSearchParams(window.location.search).get(
      DETECTOR_TOUR_WELCOME_PARAM,
    );
    if (
      !shouldStartDetectorTour({
        isSignedIn: true,
        createdAt: user?.createdAt,
        welcomeParam,
        tourDone: false,
      })
    ) {
      return;
    }

    startedRef.current = true;
    setStepIndex(0);
    document.getElementById("humanizer")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.history.replaceState(
      {},
      "",
      stripWelcomeParamFromUrl(window.location.href),
    );
  }, [isLoaded, isSignedIn, user?.createdAt]);

  useEffect(() => {
    if (stepIndex === null) return;
    const step = DETECTOR_TOUR_STEPS[stepIndex];
    onSelect(step.id);
    onActiveDetectorChange(step.id);
    chipRefs.current[step.id]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [chipRefs, onActiveDetectorChange, onSelect, stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, stepIndex]);

  if (stepIndex === null || typeof document === "undefined") return null;

  const step = DETECTOR_TOUR_STEPS[stepIndex];
  const anchor = chipRefs.current[step.id] ?? null;

  return createPortal(
    <TourBubble
      step={step}
      stepIndex={stepIndex}
      stepCount={DETECTOR_TOUR_STEPS.length}
      anchor={anchor}
      onPrevious={() => setStepIndex((index) => Math.max(0, (index ?? 0) - 1))}
      onNext={() => {
        if (stepIndex >= DETECTOR_TOUR_STEPS.length - 1) {
          finish();
          return;
        }
        setStepIndex(stepIndex + 1);
      }}
      onFinish={finish}
    />,
    document.body,
  );
}

function TourBubble({
  step,
  stepIndex,
  stepCount,
  anchor,
  onPrevious,
  onNext,
  onFinish,
}: {
  step: DetectorTourStep;
  stepIndex: number;
  stepCount: number;
  anchor: HTMLButtonElement | null;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    caret: 132,
    placement: "top" as "top" | "bottom",
  });

  useLayoutEffect(() => {
    setReady(false);
    const update = () => {
      const bubble = bubbleRef.current;
      if (!anchor || !bubble) return;
      const rect = anchor.getBoundingClientRect();
      const size = bubble.getBoundingClientRect();
      const gap = 10;
      const viewportPad = 8;
      let placement: "top" | "bottom" = "top";
      let top = rect.top - size.height - gap;
      if (top < viewportPad) {
        placement = "bottom";
        top = rect.bottom + gap;
      }
      let left = rect.left + rect.width / 2 - size.width / 2;
      left = Math.max(
        viewportPad,
        Math.min(left, window.innerWidth - size.width - viewportPad),
      );
      const caret = Math.max(
        16,
        Math.min(rect.left + rect.width / 2 - left, size.width - 16),
      );
      setCoords({ top, left, caret, placement });
      setReady(true);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (anchor) observer?.observe(anchor);
    if (bubbleRef.current) observer?.observe(bubbleRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [anchor, step.id]);

  const Icon = STEP_ICONS[step.id];
  const isLast = stepIndex === stepCount - 1;
  const isFirst = stepIndex === 0;

  return (
    <div
      ref={bubbleRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detector-tour-title"
      className={cn(
        "fixed z-[90] w-[min(17.25rem,calc(100vw-1rem))] rounded-xl border border-white/10 bg-[#1b2438] p-2.5 text-white shadow-[0_12px_32px_rgba(15,23,42,0.35)]",
        !ready && "invisible",
      )}
      style={{ top: coords.top, left: coords.left }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute h-2 w-2 rotate-45 bg-[#1b2438]"
        style={
          coords.placement === "top"
            ? { bottom: -4, left: coords.caret, transform: "translateX(-50%) rotate(45deg)" }
            : { top: -4, left: coords.caret, transform: "translateX(-50%) rotate(45deg)" }
        }
      />

      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {stepIndex + 1} of {stepCount}
      </p>

      <div className="mt-1.5 flex items-start gap-1.5">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[#8ec5ff]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="detector-tour-title" className="text-[13px] font-semibold leading-tight">
            {step.title}
          </h2>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#8ec5ff]">
            {step.subtitle}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-white/80">{step.body}</p>

      <div className="mt-2 rounded-lg border border-[#7c5cfc]/45 bg-[#252f4a] px-2 py-1.5 text-[10px] leading-snug text-white/90">
        {step.callout}
      </div>

      {step.footer ? (
        <p className="mt-1.5 text-[10px] leading-snug text-white/55">{step.footer}</p>
      ) : null}

      <div className={cn("mt-2.5 flex items-center gap-2", isFirst ? "justify-end" : "justify-between")}>
        {isFirst ? null : (
          <button
            type="button"
            onClick={onPrevious}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Previous
          </button>
        )}
        <button
          type="button"
          onClick={isLast ? onFinish : onNext}
          className="inline-flex items-center gap-1 rounded-full bg-[#7c5cfc] px-3 py-1 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(124,92,252,0.35)] transition-colors hover:bg-[#6f4ff0]"
        >
          {isLast ? (
            <>
              Got it!
              <Sparkles className="h-3 w-3" aria-hidden />
            </>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
}
