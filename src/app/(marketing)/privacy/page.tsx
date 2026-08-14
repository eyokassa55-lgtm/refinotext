import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_PAGES } from "@/lib/legal-content";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main>
        <LegalDocument page={LEGAL_PAGES.privacy} />
      </main>
      <LandingFooter />
    </>
  );
}
