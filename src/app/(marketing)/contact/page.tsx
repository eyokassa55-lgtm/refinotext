import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { ContactPageContent } from "@/components/legal/contact-page-content";

import { CONTACT_FAQS } from "@/lib/legal-content";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
  pageMetadata,
} from "@/lib/seo";

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
      <JsonLd data={buildFaqPageJsonLd(CONTACT_FAQS, PAGE_SEO.contact.path)} />
      <AnnouncementBar />
      <Navbar />
      <main>
        <ContactPageContent />
      </main>
      <LandingFooter />
    </>
  );
}
