import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { HOW_IT_WORKS } from "@/lib/landing-data";

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-20 sm:py-28"
    >
      <Container>
        <SectionHeader
          eyebrow="How it works"
          title="Four steps to authentic writing"
          description="From paste to publish in under a minute. No learning curve required."
          className="mb-14"
        />

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.step} className="relative">
              {index < HOW_IT_WORKS.length - 1 && (
                <div
                  className="absolute left-8 top-16 hidden h-px w-[calc(100%-2rem)] bg-border lg:block"
                  aria-hidden
                />
              )}
              <div className="flex flex-col">
                <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                  {step.step}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
