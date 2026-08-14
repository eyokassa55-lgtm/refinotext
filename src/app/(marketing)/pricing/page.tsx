import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="pt-8">
        <PricingSection />
      </main>
      <LandingFooter />
    </>
  );
}
