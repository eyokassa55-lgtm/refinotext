"use client";

import Link from "next/link";
import { useState } from "react";

import { FaqAccordionItem } from "@/components/landing/faq-accordion-item";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ROUTES } from "@/lib/constants";
import { FAQ_PAGE_SECTIONS } from "@/lib/landing-data";

function faqKey(sectionIndex: number, itemIndex: number) {
  return `${sectionIndex}-${itemIndex}`;
}

export function FaqPageContent() {
  const [openKey, setOpenKey] = useState<string | null>("0-0");

  return (
    <div className="bg-gradient-to-b from-card/30 via-background to-background pb-20 pt-8 sm:pb-28 sm:pt-10">
      <Container className="max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href={ROUTES.home}
                className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Home
              </Link>
            </li>
            <li aria-hidden className="text-muted/60">
              &gt;
            </li>
            <li className="font-medium text-foreground">FAQ</li>
          </ol>
        </nav>

        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
            Frequently Asked Questions
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]">
            Everything You Need to Know
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Get answers about our AI humanizer, credits, billing, and how to get
            the best results from RefinoText.
          </p>
        </header>

        <div className="mt-12 sm:mt-14">
          {FAQ_PAGE_SECTIONS.map((section, sectionIndex) => (
            <section
              key={section.title}
              aria-labelledby={`faq-section-${sectionIndex}`}
              className="mt-10 first:mt-0 sm:mt-12"
            >
              <h2
                id={`faq-section-${sectionIndex}`}
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                {section.title}
              </h2>

              <div className="mt-4 rounded-2xl border border-border/70 bg-card px-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)] sm:px-6">
                {section.items.map((item, itemIndex) => {
                  const key = faqKey(sectionIndex, itemIndex);
                  return (
                    <FaqAccordionItem
                      key={item.question}
                      question={item.question}
                      answer={item.answer}
                      open={openKey === key}
                      onToggle={() =>
                        setOpenKey((current) =>
                          current === key ? null : key,
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section
          aria-labelledby="faq-cta-heading"
          className="mt-14 rounded-2xl border border-border/70 bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,20,0.04),0_12px_28px_rgba(13,92,69,0.06)] sm:mt-16 sm:px-10"
        >
          <h2
            id="faq-cta-heading"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            Still have questions?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Can&apos;t find the answer you&apos;re looking for? Our support team
            is here to help.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button href={ROUTES.contact} size="md">
              Contact Support
            </Button>
            <Button href={ROUTES.pricing} variant="secondary" size="md">
              View Pricing Plans
            </Button>
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted">
          <strong className="font-semibold text-foreground">
            RefinoText supports honest writing.
          </strong>{" "}
          We expect writers to uphold academic and professional ethics while
          improving clarity.{" "}
          <Link
            href={ROUTES.acceptableUse}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Acceptable Use Policy
          </Link>
          .
        </p>
      </Container>
    </div>
  );
}
