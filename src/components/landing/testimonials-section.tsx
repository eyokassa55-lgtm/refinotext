"use client";

import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { TESTIMONIALS } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  const [active, setActive] = useState(0);
  const total = TESTIMONIALS.length;

  const goTo = useCallback(
    (index: number) => {
      setActive((index + total) % total);
    },
    [total],
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % total);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [total]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const section = document.getElementById("reviews");
      if (!section) return;
      if (!section.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  const getOffset = (index: number) => {
    let offset = index - active;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  };

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="bg-mint py-20 sm:py-28"
    >
      <Container>
        <SectionHeader
          id="reviews-heading"
          eyebrow="Loved Worldwide"
          title="500,000+ Writers Trust RefinoText Daily"
          description="Real results from students, creators, and agencies who transformed stiff AI output into natural, human-grade writing that passes every detector."
          className="mb-14"
        />

        <div className="relative mx-auto max-w-4xl">
          <div
            className="testimonials-stage relative mx-auto h-[320px] sm:h-[300px]"
            aria-live="polite"
          >
            {TESTIMONIALS.map((item, index) => {
              const offset = getOffset(index);
              const isActive = offset === 0;
              const isVisible = Math.abs(offset) <= 1;

              return (
                <article
                  key={item.name}
                  aria-hidden={!isActive}
                  className={cn(
                    "testimonial-card absolute inset-x-0 top-0 mx-auto w-[min(100%,28rem)] rounded-2xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(26,143,106,0.12)] transition-all duration-500 ease-out",
                    isActive && "border-accent/40 shadow-[0_24px_80px_rgba(26,143,106,0.22)]",
                    !isVisible && "pointer-events-none",
                  )}
                  style={{
                    transform: `translateX(${offset * 58}%) rotateY(${offset * -28}deg) scale(${isActive ? 1 : 0.84})`,
                    opacity: isVisible ? (isActive ? 1 : 0.45) : 0,
                    zIndex: isActive ? 20 : 10 - Math.abs(offset),
                    filter: isActive ? "none" : "blur(1px)",
                  }}
                >
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
                    <Quote className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">
                    {item.quote}
                  </p>
                  <div className="mt-6">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-accent">{item.source}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous review"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Review slides">
              {TESTIMONIALS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  aria-label={`Show review from ${item.name}`}
                  onClick={() => goTo(index)}
                  className={cn(
                    "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active === index ? "w-8 bg-accent" : "w-2 bg-border hover:bg-muted/40",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={next}
              aria-label="Next review"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
