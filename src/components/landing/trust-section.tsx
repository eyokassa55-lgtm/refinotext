import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { TRUST_PANELS } from "@/lib/landing-data";

export function TrustSection() {
  return (
    <section
      id="privacy-billing-support"
      aria-labelledby="trust-heading"
      className="py-20 sm:py-28"
    >
      <Container>
        <SectionHeader
          id="trust-heading"
          eyebrow="Privacy, billing, and support"
          title="How RefinoText handles data, payments, and help"
          description="Short, accurate notes. The legal pages have the full text."
          className="mb-12"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {TRUST_PANELS.map((panel) => (
            <article
              key={panel.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground">{panel.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{panel.body}</p>
              <Link
                href={panel.href}
                className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {panel.linkLabel} →
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
