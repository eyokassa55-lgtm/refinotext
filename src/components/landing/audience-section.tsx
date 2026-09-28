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
  width: number;
  height: number;
};

const PROOF_SLIDES: ProofSlide[] = [
  {
    name: "Copyleaks",
    iconSrc: "/marks/copyleaks.png",
    screenshotSrc: "/proof/copyleaks.png?v=4k",
    width: 4096,
    height: 2036,
  },
  {
    name: "GPTZero",
    iconSrc: "/marks/gptzero.png",
    screenshotSrc: "/proof/gptzero.png?v=4k",
    width: 4096,
    height: 2024,
  },
  {
    name: "Originality.ai",
    iconSrc: "/marks/originality.png",
    screenshotSrc: "/proof/originality.png?v=4k",
    width: 4096,
    height: 2044,
  },
  {
    name: "Pangram",
    iconSrc: "/marks/pangram.png",
    screenshotSrc: "/proof/pangram.png?v=4k",
    width: 4096,
    height: 2024,
  },
  {
    name: "QuillBot",
    iconSrc: "/marks/quillbot.png",
    screenshotSrc: "/proof/quillbot.png?v=4k",
    width: 4096,
    height: 1884,
  },
  {
    name: "Scribbr",
    iconSrc: "/marks/scribbr.png",
    screenshotSrc: "/proof/scribbr.png?v=4k",
    width: 4096,
    height: 2036,
  },
  {
    name: "Smodin",
    iconSrc: "/marks/smodin.png",
    screenshotSrc: "/proof/smodin.png?v=4k",
    width: 4096,
    height: 1904,
  },
  {
    name: "Undetectable AI",
    iconSrc: "/marks/undetectable.png",
    screenshotSrc: "/proof/undetectable.png?v=4k",
    iconClassName: "rounded-md",
    width: 4096,
    height: 1616,
  },
  {
    name: "Winston AI",
    iconSrc: "/marks/winston.png",
    screenshotSrc: "/proof/winston.png?v=4k",
    iconClassName: "rounded-full",
    width: 4096,
    height: 1960,
  },
];

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
      className="relative overflow-x-clip bg-white py-24 sm:py-32"
    >
      <Container className="relative">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <div className="tagline-lines mx-auto mb-4 justify-center text-[10px] text-slate-500 sm:text-[11px]">
            Lab readout
          </div>
          <h2
            id="audience-heading"
            className="mb-3 text-balance text-xl font-semibold lowercase tracking-[0.02em] text-slate-900 sm:mb-4 sm:text-4xl md:text-5xl"
            style={{
              fontFamily:
                "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            Detection boards, human verdicts
          </h2>
          <p
            className="text-xs leading-relaxed text-slate-600 sm:text-base md:text-lg"
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            }}
          >
            Same RefinoText drafts across major scanners — proof the writing
            reads as human without losing clarity.
          </p>
          <div className="mt-6 flex justify-center">
            <TrustedWritersBadge className="border-border/60 bg-mint" />
          </div>
        </div>

        <div
          className="mb-5 flex flex-wrap justify-center gap-2"
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
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/80 bg-card text-muted hover:border-border hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full bg-white p-0.5",
                    selected && "bg-white/95",
                  )}
                >
                  <Image
                    src={item.iconSrc}
                    alt=""
                    width={64}
                    height={64}
                    sizes="24px"
                    quality={100}
                    className={cn("h-4 w-4 object-contain", item.iconClassName)}
                  />
                </span>
                {item.name}
                {selected ? <span className="font-medium opacity-80">· Human</span> : null}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous result"
            onClick={() => goTo(activeIndex - 1)}
            className="absolute -left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card text-muted shadow-sm transition-colors hover:text-foreground sm:-left-5 sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next result"
            onClick={() => goTo(activeIndex + 1)}
            className="absolute -right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card text-muted shadow-sm transition-colors hover:text-foreground sm:-right-5 sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <figure key={slide.name} className="proof-slide-in">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Image
                src={slide.iconSrc}
                alt=""
                width={64}
                height={64}
                sizes="28px"
                quality={100}
                className={cn("h-5 w-5 object-contain", slide.iconClassName)}
              />
              <p className="text-sm font-semibold text-foreground">
                {slide.name}
                <span className="text-muted"> · </span>
                <span className="text-[#2f8a38]">Human</span>
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-[92%] overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white shadow-[0_10px_30px_rgba(47,58,52,0.08)]">
                <Image
                  src={slide.screenshotSrc}
                  alt={`${slide.name} human writing result`}
                  width={slide.width}
                  height={slide.height}
                  quality={100}
                  unoptimized
                  priority={activeIndex === 0}
                  sizes="(max-width: 1024px) 92vw, 1050px"
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>
            <figcaption className="mt-3 px-1 text-sm text-muted">
              {slide.name} detector: sample output classified as human-written
            </figcaption>
          </figure>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 sm:hidden">
          {PROOF_SLIDES.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-label={`Go to ${item.name}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                index === activeIndex ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted/50",
              )}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button href="#humanizer" size="md">
            Try this in the editor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </Container>
    </section>
  );
}
