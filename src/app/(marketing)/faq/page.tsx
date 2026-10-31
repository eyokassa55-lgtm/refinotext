import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { FaqPageContent } from "@/components/legal/faq-page-content";

import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
  pageMetadata,
} from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.faq.path,
  PAGE_SEO.faq.title,
  PAGE_SEO.faq.description,
);

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd(
          PAGE_SEO.faq.path,
          PAGE_SEO.faq.title,
          PAGE_SEO.faq.description,
        )}
      />
      <JsonLd data={buildFaqPageJsonLd()} />
      <AnnouncementBar />
      <Navbar />
      <main>
        <FaqPageContent />
      </main>
      <LandingFooter />
    </>
  );
}
