"use client";

import Link from "next/link";
import { useState } from "react";

import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CONTACT_FAQS } from "@/lib/legal-content";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export function ContactPageContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitted(true);
  };

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
            <li className="font-medium text-foreground">Contact Us</li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            Have a question about billing, your account, or the humanizer?
            Send us a message and we&apos;ll get back to you. For refunds or
            urgent support, email us directly at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </header>

        <div className="mb-6 rounded-xl border border-accent/20 bg-accent-light/50 px-4 py-3 sm:px-5">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Support &amp; refunds:</span>{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {submitted ? (
            <div className="text-center py-8">
              <p className="text-lg font-semibold text-foreground">
                Message received
              </p>
              <p className="mt-2 text-sm text-muted">
                Thanks, {name}. We&apos;ll reply to {email} soon.
              </p>
              <Button
                className="mt-6"
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setEmail("");
                  setMessage("");
                }}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-mint-dark/30 px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-mint-dark/30 px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-foreground">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full resize-y rounded-xl border border-border bg-mint-dark/30 px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="How can we help?"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          )}
        </div>

        <div className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Common questions
          </h2>
          <p className="mb-5 text-sm text-muted">
            Click a question to view the full answer.
          </p>
          <Accordion items={CONTACT_FAQS} />
        </div>
      </Container>
    </div>
  );
}
