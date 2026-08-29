import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { FAQ_ITEMS } from "@/lib/landing-data";
import { ROUTES } from "@/lib/constants";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-28">
      <Container>
        <SectionHeader
          id="faq-heading"
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="What RefinoText is, how billing with Polar works, and how to get support."
          className="mb-12"
        />

        <div className="mx-auto max-w-3xl">
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="px-6 py-5">
                <h3 className="text-base font-semibold text-foreground">
                  {item.question}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            Full policies:{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href={ROUTES.privacy}>
              Privacy
            </Link>
            ,{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href={ROUTES.terms}>
              Terms
            </Link>
            ,{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href={ROUTES.refunds}>
              Refunds
            </Link>
            , and{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href={ROUTES.acceptableUse}>
              Acceptable Use
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
