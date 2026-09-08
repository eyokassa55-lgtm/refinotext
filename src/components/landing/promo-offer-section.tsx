"use client";

import { Container } from "@/components/ui/container";
import { PromoOfferBanner } from "@/components/landing/promo-offer-banner";

export function PromoOfferSection() {
  return (
    <section
      id="promo-offer"
      aria-labelledby="promo-offer-heading"
      className="bg-gradient-to-b from-background via-background to-card/20 pt-16 pb-6 sm:pt-20 sm:pb-8"
    >
      <Container className="max-w-7xl">
        <div className="mb-8 flex items-center justify-center gap-4 sm:mb-10">
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
          <p
            id="promo-offer-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-accent"
          >
            Special offer
          </p>
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
        </div>

        <PromoOfferBanner />
      </Container>
    </section>
  );
}
