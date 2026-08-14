import { Container } from "@/components/ui/container";
import { Accordion } from "@/components/ui/accordion";
import { SectionHeader } from "@/components/ui/section-header";
import { FAQ_ITEMS } from "@/lib/landing-data";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-28">
      <Container>
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything you need to know about RefinoText."
          className="mb-12"
        />

        <div className="mx-auto max-w-3xl">
          <Accordion items={FAQ_ITEMS} />
        </div>
      </Container>
    </section>
  );
}
