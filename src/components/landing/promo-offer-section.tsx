"use client";

import { Container } from "@/components/ui/container";
import { PromoOfferBanner } from "@/components/landing/promo-offer-banner";

export function PromoOfferSection() {
  return (
    <section
      id="promo-offer"
      aria-labelledby="promo-offer-heading"
      className="bg-white pt-16 pb-6 sm:pt-20 sm:pb-8"
    >
      <Container className="max-w-7xl">
        <div className="mb-8 flex items-center justify-center sm:mb-10">
          <p
            id="promo-offer-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-accent"
          >
            Special offer
          </p>
        </div>

        <PromoOfferBanner />
      </Container>
    </section>
  );
}
