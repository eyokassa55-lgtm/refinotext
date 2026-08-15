import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_PAGES } from "@/lib/legal-content";

import { PAGE_SEO, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.acceptableUse.path,
  PAGE_SEO.acceptableUse.title,
  PAGE_SEO.acceptableUse.description,
);

export default function AcceptableUsePage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main>
        <LegalDocument page={LEGAL_PAGES["acceptable-use"]} />
      </main>
      <LandingFooter />
    </>
  );
}
