"use client";

import Image from "next/image";
import { useState } from "react";

import { Container } from "@/components/ui/container";
import { FIELD_NOTES_TESTIMONIALS } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

function ProfileAvatar({
  name,
  avatarSrc,
  selected = false,
  size,
  className,
  onClick,
  tabIndex,
  role,
  ariaSelected,
  ariaLabel,
  subdued = false,
}: {
  name: string;
  avatarSrc: string;
  selected?: boolean;
  size: number;
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
  role?: string;
  ariaSelected?: boolean;
  ariaLabel?: string;
  subdued?: boolean;
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      role={role}
      tabIndex={tabIndex}
      aria-selected={ariaSelected}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border transition-all duration-300",
        selected
          ? "scale-110 border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-light)_80%,transparent)]"
          : "border-border/45 bg-card/80",
        subdued && !selected && "opacity-35 hover:opacity-60",
        className,
      )}
    >
      <Image
        src={avatarSrc}
        alt={selected ? name : ""}
        fill
        sizes={`${size}px`}
        className="object-cover"
        aria-hidden={!selected}
      />
    </Component>
  );
}

export function HowItWorksSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonial = FIELD_NOTES_TESTIMONIALS[activeIndex];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative overflow-x-clip border-b border-border/40 bg-gradient-to-b from-background via-card/20 to-card/30 py-12 pb-14 sm:py-16 sm:pb-20"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_0%,color-mix(in_srgb,var(--accent-light)_22%,transparent),transparent_72%)]"
        aria-hidden
      />

      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 flex items-center justify-center gap-4 sm:mb-6">
            <span
              className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
              aria-hidden
            />
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
              Field notes
            </p>
            <span
              className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
              aria-hidden
            />
          </div>

          <h2
            id="how-it-works-heading"
            className="text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl sm:leading-[1.08]"
          >
            loud love from operators{" "}
            <span className="font-display text-[1.08em] font-bold italic text-primary">
              worldwide
            </span>
          </h2>

          <p className="mx-auto mt-3 max-w-xl font-mono text-lg leading-7 text-muted">
            Real desks, blunt feedback—how RefinoText slots into chaotic weeks.
          </p>

          <div className="relative z-[1] mx-auto mt-8 max-w-2xl sm:mt-9">
            <div
              className="pointer-events-none absolute -left-1 top-0 select-none font-serif text-[5rem] leading-none text-accent-light sm:-left-2 sm:text-[6rem]"
              aria-hidden
            >
              &ldquo;
            </div>

            <blockquote
              key={activeIndex}
              className="field-notes-quote-in relative px-2 sm:px-6"
            >
              <p className="text-lg leading-7 text-foreground">
                {testimonial.quoteBefore}
                <span className="font-semibold text-primary">
                  {testimonial.quoteHighlight}
                </span>
                {testimonial.quoteAfter}
              </p>
            </blockquote>

            <footer className="mt-5 flex flex-col items-center sm:mt-6">
              <ProfileAvatar
                name={testimonial.name}
                avatarSrc={testimonial.avatarSrc}
                selected
                size={52}
                className="mb-2 shadow-[0_8px_20px_rgba(13,92,69,0.12)]"
              />
              <p className="text-lg font-bold leading-7 text-foreground">
                {testimonial.name}
              </p>
              <p className="mt-0.5 text-lg leading-7 text-muted">
                {testimonial.role}
              </p>
            </footer>
          </div>

          <div
            className="relative z-[1] mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-9"
            role="tablist"
            aria-label="Testimonials"
          >
            {FIELD_NOTES_TESTIMONIALS.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <ProfileAvatar
                  key={item.name}
                  name={item.name}
                  avatarSrc={item.avatarSrc}
                  selected={selected}
                  size={selected ? 40 : 34}
                  role="tab"
                  ariaSelected={selected}
                  ariaLabel={`Show testimonial from ${item.name}`}
                  onClick={() => setActiveIndex(index)}
                  subdued={!selected}
                />
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
