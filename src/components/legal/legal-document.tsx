import Link from "next/link";

import { Container } from "@/components/ui/container";
import type { LegalPage } from "@/lib/legal-content";
import { ROUTES } from "@/lib/constants";

type LegalDocumentProps = {
  page: LegalPage;
};

export function LegalDocument({ page }: LegalDocumentProps) {
  return (
    <div className="bg-background pb-20 pt-8 sm:pb-28 sm:pt-10">
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
          <p className="mt-3 text-sm text-muted">Last updated: {page.lastUpdated}</p>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            {page.intro}
          </p>
        </header>

        <div className="space-y-10">
          {page.sections.map((section) => (
            <section key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted sm:text-base">
                {section.content}
              </p>

              {section.bullets && (
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted sm:text-base">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}

              {section.email && (
                <p className="text-sm leading-relaxed text-muted sm:text-base">
                  Email us at{" "}
                  <a
                    href={`mailto:${section.email}`}
                    className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  {sub.content && (
                    <p className="text-sm leading-relaxed text-muted sm:text-base">
                      {sub.content}
                    </p>
                  )}
                  {sub.bullets && (
                    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted sm:text-base">
                      {sub.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>

        {page.footerNote && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              {page.footerNote}
            </p>
            {page.footerLinkHref && page.footerLinkLabel && (
              <Link
                href={page.footerLinkHref}
                className="mt-4 inline-flex rounded-sm text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
