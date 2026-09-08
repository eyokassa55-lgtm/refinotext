"use client";

import Link from "next/link";
import { useState } from "react";

import { FaqAccordionItem } from "@/components/landing/faq-accordion-item";
import { Container } from "@/components/ui/container";
import { FAQ_LANDING_ITEMS } from "@/lib/landing-data";
import { ROUTES } from "@/lib/constants";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative overflow-x-clip bg-gradient-to-b from-card/60 via-background to-background py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_0%,color-mix(in_srgb,var(--accent-light)_55%,transparent),transparent_72%)]"
        aria-hidden
      />

      <Container className="relative">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 flex items-center justify-center gap-4 sm:mb-12">
            <span
              className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
              aria-hidden
            />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              FAQ
            </p>
            <span
              className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
              aria-hidden
            />
          </div>

          <h2
            id="faq-heading"
            className="text-center text-3xl font-bold tracking-[-0.03em] sm:text-4xl"
          >
            Questions /{" "}
            <span className="font-display text-[1.08em] font-bold italic text-primary">
              answers
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-center font-mono text-sm leading-6 text-muted sm:text-[15px]">
            Quick answers on how RefinoText handles rewrites, credits, and privacy.
          </p>

          <div className="mt-10 rounded-2xl border border-border/70 bg-card px-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)] sm:mt-12 sm:px-6">
            {FAQ_LANDING_ITEMS.map((item, index) => (
              <FaqAccordionItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                open={openIndex === index}
                onToggle={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
              />
            ))}
          </div>

          <p className="mt-8 text-center">
            <Link
              href={ROUTES.faq}
              className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              View all FAQs
            </Link>
          </p>

          <p className="mt-6 text-center font-mono text-xs text-muted sm:text-sm">
            Full policies:{" "}
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href={ROUTES.privacy}
            >
              Privacy
            </Link>
            ,{" "}
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href={ROUTES.terms}
            >
              Terms
            </Link>
            ,{" "}
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href={ROUTES.refunds}
            >
              Refunds
            </Link>
            , and{" "}
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href={ROUTES.acceptableUse}
            >
              Acceptable Use
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
