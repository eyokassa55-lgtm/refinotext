import { ExternalLink, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { FeaturesIntegrationPanel } from "@/components/landing/features-integration-panel";
import { Container } from "@/components/ui/container";
import { FEATURES_HIGHLIGHTS } from "@/lib/landing-data";

const iconMap = {
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  lock: Lock,
};

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="relative overflow-x-clip border-b border-border/40 bg-card/60 py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_0%_50%,color-mix(in_srgb,var(--accent-light)_45%,transparent),transparent_72%)]"
        aria-hidden
      />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Features
            </p>
            <h2
              id="features-heading"
              className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl"
            >
              Tools for clearer AI-assisted writing
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-7 text-muted">
              Meaning-preserving rewrites for students, creators, and
              professionals — compatible with the review tools on the right.
            </p>

            <ul className="mt-10 space-y-6">
              {FEATURES_HIGHLIGHTS.map((feature) => {
                const Icon = iconMap[feature.icon as keyof typeof iconMap];

                return (
                  <li key={feature.title} className="flex gap-4">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-7 tracking-tight text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-lg leading-7 text-muted">
                        {feature.description}
                        {"docHref" in feature && feature.docHref ? (
                          <>
                            {" "}
                            <Link
                              href={feature.docHref}
                              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {feature.docLabel}
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <FeaturesIntegrationPanel />
        </div>
      </Container>
    </section>
  );
}
