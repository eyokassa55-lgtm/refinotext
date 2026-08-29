import {
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { FEATURES } from "@/lib/landing-data";

const iconMap = {
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  palette: Palette,
  zap: Zap,
  target: Target,
  lock: Lock,
};

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-card/60 py-20 sm:py-28"
    >
      <Container>
        <SectionHeader
          eyebrow="Features"
          title="Tools for clearer AI-assisted writing"
          description="Tone, readability, and meaning-preserving rewrites for students, creators, and professionals."
          className="mb-14"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap];

            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex rounded-xl bg-accent-light p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
