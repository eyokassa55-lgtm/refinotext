import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/navbar";
import { ContactPageContent } from "@/components/legal/contact-page-content";

export const metadata = {
  title: "Contact Us",
};

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
