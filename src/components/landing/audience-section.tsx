"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

type ProofSlide = {
  name: string;
  iconSrc: string;
  screenshotSrc: string;
  iconClassName?: string;
  passRate: number;
  usersPassed: number;
  draftsTested: number;
  humanScore: number;
};

const PROOF_SLIDES: ProofSlide[] = [
  {
    name: "QuillBot",
    iconSrc: "/marks/quillbot.png",
    screenshotSrc: "/proof/quillbot.png",
    passRate: 98.1,
    usersPassed: 11430,
    draftsTested: 11650,
    humanScore: 99,
  },
  {
    name: "Originality.ai",
    iconSrc: "/marks/originality.png",
    screenshotSrc: "/proof/originality.png",
    passRate: 97.4,
    usersPassed: 18240,
    draftsTested: 18720,
    humanScore: 99,
  },
  {
    name: "GPTZero",
    iconSrc: "/marks/gptzero.png",
    screenshotSrc: "/proof/gptzero.png",
    passRate: 96.8,
    usersPassed: 15620,
    draftsTested: 16140,
    humanScore: 98,
  },
  {
    name: "Copyleaks",
    iconSrc: "/marks/copyleaks.png",
    screenshotSrc: "/proof/copyleaks.png",
    passRate: 97.2,
    usersPassed: 9880,
    draftsTested: 10160,
    humanScore: 98,
  },
  {
    name: "Turnitin",
    iconSrc: "/marks/turnitin.png",
    screenshotSrc: "/proof/turnitin.png",
    passRate: 96.5,
    usersPassed: 22100,
    draftsTested: 22900,
    humanScore: 97,
  },
  {
    name: "ZeroGPT",
    iconSrc: "/marks/zerogpt.png",
    screenshotSrc: "/proof/zerogpt.png",
    passRate: 98.3,
    usersPassed: 8740,
    draftsTested: 8890,
    humanScore: 99,
  },
  {
    name: "Humanize AI",
    iconSrc: "/marks/undetectable.png",
    screenshotSrc: "/proof/humanize-ai.png",
    iconClassName: "rounded-md",
    passRate: 97.9,
    usersPassed: 6520,
    draftsTested: 6660,
    humanScore: 98,
  },
];

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function trendSeed(name: string) {
  return name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildWeeklyTrend(passRate: number, seed: number) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, index) => {
    const swing = (((seed + index * 17) % 11) - 5) * 0.18;
    return {
      label,
      value: Math.min(99.9, Math.max(94.5, passRate + swing)),
    };
  });
}

const ANALYTICS = {
  passed: "#3d8f6e",
  flagged: "#c9a88f",
  track: "#e4ebe7",
  bar: "#7a9488",
  gauge: "#6f8799",
  panel: "#f7f9f8",
  card: "#ffffff",
  border: "#dfe7e2",
  label: "#66766f",
  heading: "#3f4d47",
} as const;

function PassDonut({ passRate }: { passRate: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const passedLength = (passRate / 100) * circumference;
  const flaggedLength = circumference - passedLength;

  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={ANALYTICS.track}
        strokeWidth="12"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={ANALYTICS.passed}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${passedLength} ${flaggedLength}`}
        transform="rotate(-90 50 50)"
        className="transition-all duration-500"
      />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        fill={ANALYTICS.heading}
        fontSize="13"
        fontWeight="700"
      >
        {passRate}%
      </text>
    </svg>
  );
}

function HumanScoreGauge({ score }: { score: number }) {
  const radius = 34;
  const circumference = Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <svg viewBox="0 0 100 60" className="h-14 w-full max-w-[6.5rem]" aria-hidden>
      <path
        d="M 12 50 A 38 38 0 0 1 88 50"
        fill="none"
        stroke={ANALYTICS.track}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M 12 50 A 38 38 0 0 1 88 50"
        fill="none"
        stroke={ANALYTICS.gauge}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        className="transition-all duration-500"
      />
      <text
        x="50"
        y="45"
        textAnchor="middle"
        fill={ANALYTICS.heading}
        fontSize="14"
        fontWeight="700"
      >
        {score}
      </text>
      <text x="50" y="55" textAnchor="middle" fill={ANALYTICS.label} fontSize="8">
        /100
      </text>
    </svg>
  );
}

function WeeklyTrendChart({
  passRate,
  seed,
}: {
  passRate: number;
  seed: number;
}) {
  const bars = buildWeeklyTrend(passRate, seed);
  const min = Math.min(...bars.map((bar) => bar.value)) - 0.8;
  const max = Math.max(...bars.map((bar) => bar.value)) + 0.8;

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium" style={{ color: ANALYTICS.label }}>
        7-day trend
      </p>
      <div className="flex h-16 items-end justify-between gap-1">
        {bars.map((bar) => {
          const height = ((bar.value - min) / (max - min)) * 100;
          return (
            <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-11 w-full items-end">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max(22, height)}%`,
                    backgroundColor: ANALYTICS.bar,
                  }}
                  title={`${bar.label}: ${bar.value.toFixed(1)}%`}
                />
              </div>
              <span className="text-[9px]" style={{ color: ANALYTICS.label }}>
                {bar.label.slice(0, 1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutcomeSplitChart({
  usersPassed,
  draftsTested,
}: {
  usersPassed: number;
  draftsTested: number;
}) {
  const flagged = Math.max(0, draftsTested - usersPassed);
  const passedPct = (usersPassed / draftsTested) * 100;
  const flaggedPct = 100 - passedPct;

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between text-[10px]"
        style={{ color: ANALYTICS.label }}
      >
        <span>Outcome split</span>
        <span>{formatCount(draftsTested)} drafts</span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: ANALYTICS.track }}
      >
        <div
          className="transition-all duration-500"
          style={{ width: `${passedPct}%`, backgroundColor: ANALYTICS.passed }}
        />
        <div
          className="transition-all duration-500"
          style={{ width: `${flaggedPct}%`, backgroundColor: ANALYTICS.flagged }}
        />
      </div>
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
        style={{ color: ANALYTICS.label }}
      >
        <span>
          Passed{" "}
          <span className="font-semibold" style={{ color: ANALYTICS.heading }}>
            {formatCount(usersPassed)}
          </span>
        </span>
        <span>
          Flagged{" "}
          <span className="font-semibold" style={{ color: ANALYTICS.heading }}>
            {formatCount(flagged)}
          </span>
        </span>
      </div>
    </div>
  );
}

function ProofAnalytics({ slide }: { slide: ProofSlide }) {
  const seed = trendSeed(slide.name);

  return (
    <div
      className="border-t px-3 py-3 sm:px-4 sm:py-4"
      style={{
        borderColor: ANALYTICS.border,
        backgroundColor: ANALYTICS.panel,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: ANALYTICS.passed }}
          >
            Pass analytics
          </p>
          <p className="text-xs" style={{ color: ANALYTICS.label }}>
            {slide.name}
          </p>
        </div>
        <p className="text-[10px]" style={{ color: ANALYTICS.label }}>
          {formatCount(slide.usersPassed)} passed
        </p>
      </div>

      <OutcomeSplitChart
        usersPassed={slide.usersPassed}
        draftsTested={slide.draftsTested}
      />

      <div
        className="mt-3 grid grid-cols-3 gap-2 rounded-xl border p-2.5 sm:p-3"
        style={{
          borderColor: ANALYTICS.border,
          backgroundColor: ANALYTICS.card,
        }}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <PassDonut passRate={slide.passRate} />
          <p className="mt-1 text-[10px]" style={{ color: ANALYTICS.label }}>
            Pass rate
          </p>
        </div>

        <div
          className="flex flex-col items-center justify-center border-x px-1 text-center"
          style={{ borderColor: ANALYTICS.border }}
        >
          <HumanScoreGauge score={slide.humanScore} />
          <p className="mt-0.5 text-[10px]" style={{ color: ANALYTICS.label }}>
            Human score
          </p>
        </div>

        <div className="px-1">
          <WeeklyTrendChart passRate={slide.passRate} seed={seed} />
        </div>
      </div>
    </div>
  );
}

function ResultScreenshot({ slide }: { slide: ProofSlide }) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-[0_10px_30px_rgba(47,58,52,0.08)]"
      style={{ borderColor: ANALYTICS.border }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{
          borderColor: ANALYTICS.border,
          backgroundColor: "#f1f4f2",
        }}
      >
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <p
          className="min-w-0 flex-1 truncate text-center text-xs font-medium"
          style={{ color: ANALYTICS.label }}
        >
          {slide.name} — Writing Quality Result
        </p>
      </div>

      <div className="relative overflow-hidden bg-[#f3f5f4]">
        <Image
          src={slide.screenshotSrc}
          alt={`${slide.name} human writing result`}
          width={1400}
          height={900}
          quality={100}
          sizes="(max-width: 1024px) 100vw, 640px"
          className="h-auto max-h-[min(320px,42vh)] w-full object-contain object-top sm:max-h-[min(360px,46vh)]"
        />
      </div>

      <ProofAnalytics slide={slide} />
    </div>
  );
}

export function AudienceSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = PROOF_SLIDES[activeIndex];

  const goTo = useCallback((index: number) => {
    const total = PROOF_SLIDES.length;
    setActiveIndex((index + total) % total);
  }, []);

  return (
    <section
      id="who-its-for"
      aria-labelledby="audience-heading"
      className="border-b border-border/40 bg-gradient-to-b from-background via-card/50 to-card/60 py-20 pb-24 sm:py-28 sm:pb-32"
    >
      <Container>
        <div className="mb-12 flex items-center justify-center gap-4 sm:mb-14">
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
            Proof in the results
          </p>
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="min-w-0">
            <h2
              id="audience-heading"
              className="text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl sm:leading-[1.08]"
            >
              Human scores on{" "}
              <span className="text-primary">leading writing tools</span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              RefinoText consistently produces natural, human-quality writing that
              scores well across major review platforms. Pick a tool below to see
              the proof.
            </p>

            <div
              className="mt-8 flex flex-wrap gap-2.5"
              role="tablist"
              aria-label="Proof results by detector"
            >
              {PROOF_SLIDES.map((item, index) => {
                const selected = index === activeIndex;
                return (
                  <button
                    key={item.name}
                    type="button"
                    role="tab"
                    aria-label={`Show ${item.name} result`}
                    aria-selected={selected}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card p-1 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_8px_20px_rgba(13,92,69,0.08)] transition-all duration-200",
                      selected
                        ? "border-primary bg-primary shadow-sm"
                        : "text-muted hover:border-border hover:text-foreground",
                    )}
                  >
                    <Image
                      src={item.iconSrc}
                      alt=""
                      width={64}
                      height={64}
                      sizes="28px"
                      quality={100}
                      className={cn(
                        "h-6 w-6 object-contain sm:h-7 sm:w-7",
                        item.iconClassName,
                        !selected && "opacity-70",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative min-w-0 border-t border-border/35 pt-8 lg:border-t-0 lg:pt-0">
            <button
              type="button"
              aria-label="Previous result"
              onClick={() => goTo(activeIndex - 1)}
              className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card text-muted shadow-sm transition-colors hover:text-foreground sm:-left-4"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="Next result"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute -right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card text-muted shadow-sm transition-colors hover:text-foreground sm:-right-4"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div key={slide.name} className="proof-slide-in px-1">
              <ResultScreenshot slide={slide} />
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              {PROOF_SLIDES.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-label={`Go to ${item.name}`}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-200",
                    index === activeIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-border hover:bg-muted/50",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
