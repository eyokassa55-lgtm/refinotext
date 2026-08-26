import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { PricingSection } from "@/components/landing/pricing-section";

import { JsonLd } from "@/components/seo/json-ld";
import { PAGE_SEO, buildWebPageJsonLd, pageMetadata } from "@/lib/seo";

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
      <AnnouncementBar />
      <Navbar />
      <main className="pt-8">
        <PricingSection headingLevel="h1" />
      </main>
      <LandingFooter />
    </>
  );
}
