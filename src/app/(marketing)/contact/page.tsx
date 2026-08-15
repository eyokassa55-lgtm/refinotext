import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { ContactPageContent } from "@/components/legal/contact-page-content";

import { PAGE_SEO, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.contact.path,
  PAGE_SEO.contact.title,
  PAGE_SEO.contact.description,
);

export default function ContactPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main>
        <ContactPageContent />
      </main>
      <LandingFooter />
    </>
  );
}
