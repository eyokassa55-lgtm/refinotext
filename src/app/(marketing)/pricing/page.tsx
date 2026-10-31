import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { PromoOfferSection } from "@/components/landing/promo-offer-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { PricingFaqSection } from "@/components/landing/pricing-faq-section";
import { PRICING_FAQS } from "@/lib/landing-data";

import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
  pageMetadata,
} from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.pricing.path,
  PAGE_SEO.pricing.title,
  PAGE_SEO.pricing.description,
);

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd(
          PAGE_SEO.pricing.path,
          PAGE_SEO.pricing.title,
          PAGE_SEO.pricing.description,
        )}
      />
      <JsonLd data={buildFaqPageJsonLd(PRICING_FAQS, PAGE_SEO.pricing.path)} />
      <AnnouncementBar />
      <Navbar />
      <main className="pt-8">
        <PromoOfferSection />
        <PricingSection headingLevel="h1" />
        <PricingFaqSection />
      </main>
      <LandingFooter />
    </>
  );
}
