"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

import { TrustedWritersBadge } from "@/components/landing/trusted-writers-badge";
import { Button } from "@/components/ui/button";
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
    usersPassed: 160884,
    draftsTested: 164000,
    humanScore: 99,
  },
  {
    name: "Originality.ai",
    iconSrc: "/marks/originality.png",
    screenshotSrc: "/proof/originality.png",
    passRate: 97.4,
    usersPassed: 148048,
    draftsTested: 152000,
    humanScore: 99,
  },
  {
    name: "GPTZero",
    iconSrc: "/marks/gptzero.png",
    screenshotSrc: "/proof/gptzero.png",
    passRate: 96.8,
    usersPassed: 143264,
    draftsTested: 148000,
    humanScore: 98,
  },
  {
    name: "Copyleaks",
    iconSrc: "/marks/copyleaks.png",
    screenshotSrc: "/proof/copyleaks.png",
    passRate: 97.2,
    usersPassed: 132192,
    draftsTested: 136000,
    humanScore: 98,
  },
  {
    name: "Turnitin",
    iconSrc: "/marks/turnitin.png",
    screenshotSrc: "/proof/turnitin.png",
    passRate: 96.5,
    usersPassed: 171770,
    draftsTested: 178000,
    humanScore: 97,
  },
  {
    name: "ZeroGPT",
    iconSrc: "/marks/zerogpt.png",
    screenshotSrc: "/proof/zerogpt.png",
    passRate: 98.3,
    usersPassed: 139586,
    draftsTested: 142000,
    humanScore: 99,
  },
  {
    name: "Humanize AI",
    iconSrc: "/marks/undetectable.png",
    screenshotSrc: "/proof/humanize-ai.png",
    iconClassName: "rounded-md",
    passRate: 97.9,
    usersPassed: 125312,
    draftsTested: 128000,
    humanScore: 98,
  },
];

function formatCompact(value: number) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return Number.isInteger(thousands)
      ? `${thousands}k`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return value.toLocaleString("en-US");
}

const FRAME = {
  border: "#dfe7e2",
  label: "#66766f",
} as const;

function ResultScreenshot({ slide }: { slide: ProofSlide }) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-[0_10px_30px_rgba(47,58,52,0.08)]"
      style={{ borderColor: FRAME.border }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{
          borderColor: FRAME.border,
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
          style={{ color: FRAME.label }}
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
          sizes="(max-width: 1024px) 100vw, 720px"
          className="h-auto w-full object-contain object-top"
        />
      </div>
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
      className="relative overflow-x-clip border-b border-border/40 bg-gradient-to-b from-background via-card/20 to-card/30 py-24 sm:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_0%,color-mix(in_srgb,var(--accent-light)_22%,transparent),transparent_72%)]"
        aria-hidden
      />

      <Container className="relative">
        <div className="relative mb-12 sm:mb-16">
          <div
            className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent"
            aria-hidden
          />
          <p className="relative mx-auto w-fit bg-background px-5 text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
            Proof in the results
          </p>
        </div>

        <div className="mb-10 flex justify-center sm:mb-12">
          <TrustedWritersBadge className="border-border/60 bg-mint" />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="min-w-0">
            <h2
              id="audience-heading"
              className="proof-heading text-3xl leading-[1.12] tracking-[-0.03em] break-words sm:text-4xl lg:text-[2.55rem]"
            >
              Human scores on{" "}
              <span className="proof-heading-accent">leading writing tools</span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              RefinoText consistently produces natural, human-quality writing that
              scores well across major review platforms. Pick a tool below to see
              the proof.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { value: `${slide.passRate}%`, label: "Pass rate" },
                { value: `${slide.humanScore}`, label: "Human score" },
                {
                  value: formatCompact(slide.draftsTested),
                  label: "Drafts tested",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-border/70 bg-mint/70 px-3 py-3 shadow-[0_1px_2px_rgba(15,23,20,0.04)] sm:px-4"
                >
                  <p
                    key={`${slide.name}-${stat.label}`}
                    className="proof-stat-num proof-slide-in text-xl font-extrabold tracking-tight text-primary sm:text-2xl"
                  >
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted sm:text-xs">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="mt-8 flex flex-wrap gap-2"
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
                      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold tracking-tight shadow-[0_1px_2px_rgba(15,23,20,0.04)] transition-all duration-200",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/80 bg-card text-muted hover:border-border hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full bg-white p-0.5",
                        selected && "bg-white/95",
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
                          "h-5 w-5 object-contain",
                          item.iconClassName,
                        )}
                      />
                    </span>
                    {item.name}
                  </button>
                );
              })}
            </div>

            <Button href="#humanizer" className="mt-8" size="md">
              Try this in the editor
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
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
