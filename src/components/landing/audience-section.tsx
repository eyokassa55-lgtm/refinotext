import { BookOpen, Briefcase, PenLine } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { AUDIENCE_USE_CASES } from "@/lib/landing-data";

const icons = [BookOpen, PenLine, Briefcase] as const;

export function AudienceSection() {
  return (
    <section
      id="who-its-for"
      aria-labelledby="audience-heading"
      className="overflow-x-clip bg-mint py-20 sm:py-28"
    >
      <Container>
        <SectionHeader
          id="audience-heading"
          eyebrow="Who it is for"
          title="A clearer rewrite for everyday AI drafts"
          description="RefinoText helps students, creators, and professionals turn stiff AI output into writing that is easier to edit and publish."
          className="mb-14"
        />

        <div className="grid gap-6 md:grid-cols-3">
          {AUDIENCE_USE_CASES.map((item, index) => {
            const Icon = icons[index] ?? PenLine;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_40px_rgba(26,143,106,0.08)]"
              >
                <div className="mb-4 inline-flex rounded-xl bg-accent-light p-3 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
