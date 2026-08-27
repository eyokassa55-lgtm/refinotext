import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { AudienceSection } from "@/components/landing/audience-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { HumanizerSection } from "@/components/landing/humanizer-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { PricingSection } from "@/components/landing/pricing-section";
import { JsonLd } from "@/components/seo/json-ld";
import { buildHomeJsonLd, PAGE_SEO, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.home.path,
  PAGE_SEO.home.title,
  PAGE_SEO.home.description,
  { absoluteTitle: true },
);

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomeJsonLd()} />
      <AnnouncementBar />
      <Navbar />
      <main className="min-w-0">
        <HeroSection />
        <HumanizerSection />
        <FeaturesSection />
        <HowItWorksSection />
        <AudienceSection />
        <PricingSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </>
  );
}
