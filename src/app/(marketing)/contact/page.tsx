import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { ContactPageContent } from "@/components/legal/contact-page-content";

import { JsonLd } from "@/components/seo/json-ld";
import { PAGE_SEO, buildWebPageJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.contact.path,
  PAGE_SEO.contact.title,
  PAGE_SEO.contact.description,
);

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd(
          PAGE_SEO.contact.path,
          PAGE_SEO.contact.title,
          PAGE_SEO.contact.description,
        )}
      />
      <AnnouncementBar />
      <Navbar />
      <main>
        <ContactPageContent />
      </main>
      <LandingFooter />
    </>
  );
}
