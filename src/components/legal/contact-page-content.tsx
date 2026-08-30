"use client";

import Link from "next/link";

import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CONTACT_FAQS } from "@/lib/legal-content";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export function ContactPageContent() {
  const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("RefinoText support")}`;

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
            <li className="font-medium text-foreground">Contact Us</li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            Email the RefinoText team at{" "}
            <a
              href={mailHref}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            for product questions, billing, cancellation, or refunds. We aim to
            reply within 1–2 business days. Paid checkout and refunds are
            processed by Polar, the merchant of record.
          </p>
        </header>

        <div className="mb-6 rounded-xl border border-accent/20 bg-accent-light/50 px-4 py-4 sm:px-5">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Support email:</span>{" "}
            <a
              href={mailHref}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            For billing issues, include your account email and Polar receipt or
            order details. Cancel subscriptions from Polar’s Customer Portal using
            the link in Polar’s billing emails.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Send an email</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This opens your email app. Messages are not submitted through a form on
            this page.
          </p>
          <Button href={mailHref} className="mt-6">
            Email {SUPPORT_EMAIL}
          </Button>
          <p className="mt-4 text-xs text-muted">
            Related policies:{" "}
            <Link className="text-primary underline-offset-2 hover:underline" href={ROUTES.refunds}>
              Refunds and Cancellation
            </Link>
            {" · "}
            <Link className="text-primary underline-offset-2 hover:underline" href={ROUTES.privacy}>
              Privacy
            </Link>
            {" · "}
            <Link className="text-primary underline-offset-2 hover:underline" href={ROUTES.terms}>
              Terms
            </Link>
          </p>
        </div>

        <div className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Common questions
          </h2>
          <Accordion items={CONTACT_FAQS} />
        </div>
      </Container>
    </div>
  );
}
