import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { PricingSection } from "@/components/landing/pricing-section";

import { PAGE_SEO, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.pricing.path,
  PAGE_SEO.pricing.title,
  PAGE_SEO.pricing.description,
);

export default function PricingPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="pt-8">
        <PricingSection headingLevel="h1" />
      </main>
      <LandingFooter />
    </>
  );
}
