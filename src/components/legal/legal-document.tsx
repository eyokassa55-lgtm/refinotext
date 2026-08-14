"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Container } from "@/components/ui/container";
import type { LegalPage } from "@/lib/legal-content";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type LegalDocumentProps = {
  page: LegalPage;
};

export function LegalDocument({ page }: LegalDocumentProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="bg-background pb-20 pt-8 sm:pb-28 sm:pt-10">
      <Container className="max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href={ROUTES.home}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Home
              </Link>
            </li>
            <li aria-hidden className="text-muted/60">
              &gt;
            </li>
            <li className="font-medium text-foreground">{page.title}</li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              {page.subtitle}
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            Last updated: {page.lastUpdated}
          </p>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            {page.intro}
          </p>
          <p className="mt-3 text-sm text-muted">
            Click any section below to view the full description.
          </p>
        </header>

        <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
          {page.sections.map((section, index) => {
            const isOpen = openIndex === index;
            const panelId = `${baseId}-panel-${index}`;
            const buttonId = `${baseId}-button-${index}`;

            return (
              <div key={section.title}>
                <h2>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 sm:text-lg"
                  >
                    {section.title}
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted transition-transform duration-200",
                        isOpen && "rotate-180 text-primary",
                      )}
                      aria-hidden
                    />
                  </button>
                </h2>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={cn(
                    "overflow-hidden px-5 transition-all duration-200 sm:px-6",
                    isOpen ? "pb-6" : "pb-0",
                  )}
                >
                  {isOpen && (
                    <div className="space-y-4 text-sm leading-relaxed text-muted sm:text-base">
                      <p>{section.content}</p>

                      {section.bullets && (
                        <ul className="list-disc space-y-1.5 pl-5">
                          {section.bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}

                      {section.email && (
                        <p>
                          Email us at{" "}
                          <a
                            href={`mailto:${section.email}`}
                            className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                          >
                            {section.email}
                          </a>
                        </p>
                      )}

                      {section.subsections?.map((sub) => (
                        <div key={sub.title} className="space-y-2 pt-1">
                          <h3 className="text-sm font-semibold text-foreground sm:text-base">
                            {sub.title}
                          </h3>
                          {sub.content && <p>{sub.content}</p>}
                          {sub.bullets && (
                            <ul className="list-disc space-y-1.5 pl-5">
                              {sub.bullets.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {page.footerNote && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              {page.footerNote}
            </p>
            {page.footerLinkHref && page.footerLinkLabel && (
              <Link
                href={page.footerLinkHref}
                className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                {page.footerLinkLabel} →
              </Link>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
