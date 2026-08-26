import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_PAGES } from "@/lib/legal-content";

import { JsonLd } from "@/components/seo/json-ld";
import { PAGE_SEO, buildWebPageJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.terms.path,
  PAGE_SEO.terms.title,
  PAGE_SEO.terms.description,
);

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd(
          PAGE_SEO.terms.path,
          PAGE_SEO.terms.title,
          PAGE_SEO.terms.description,
        )}
      />
      <AnnouncementBar />
      <Navbar />
      <main>
        <LegalDocument page={LEGAL_PAGES.terms} />
      </main>
      <LandingFooter />
    </>
  );
}
