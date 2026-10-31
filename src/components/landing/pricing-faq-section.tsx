"use client";

import Link from "next/link";
import { useState } from "react";

import { FaqAccordionItem } from "@/components/landing/faq-accordion-item";
import { Container } from "@/components/ui/container";
import { PRICING_FAQS } from "@/lib/landing-data";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export function PricingFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="pricing-faq"
      aria-labelledby="pricing-faq-heading"
      className="border-t border-border/60 bg-white py-16 sm:py-24"
    >
      <Container className="max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Pricing FAQ
          </p>
          <h2
            id="pricing-faq-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Frequently Asked Questions About Plans
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Everything you need to know about RefinoText credits, billing cycles, security, and subscription management.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border/70 bg-card px-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)] sm:px-6">
          {PRICING_FAQS.map((item, index) => (
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

        <p className="mt-8 text-center text-xs text-muted sm:text-sm">
          Have more questions? Read our full{" "}
          <Link
            href={ROUTES.faq}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            General FAQ
          </Link>{" "}
          or reach our support team at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Container>
    </section>
  );
}
