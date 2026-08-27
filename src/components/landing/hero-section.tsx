import { ArrowRight, Check, Globe, Shield, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { HumanizerPreview } from "@/components/landing/humanizer-preview";
import { ROUTES } from "@/lib/constants";
import { HERO_FEATURES, TRUST_MARKERS } from "@/lib/landing-data";

const featureIcons = {
  shield: Shield,
  zap: Zap,
};

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-x-clip">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent-light)_0%,_transparent_50%)]"
        aria-hidden
      />

      <Container className="relative pt-16 pb-10 sm:pt-24 sm:pb-12 lg:pt-28 lg:pb-14">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                — AI Text Humanizer
              </span>
              <Badge variant="accent">
                <Globe className="h-3 w-3" aria-hidden />
                Free to start
              </Badge>
            </div>

            <h1
              id="hero-heading"
              className="text-4xl font-extrabold leading-[1.1] tracking-tight break-words sm:text-5xl lg:text-[3.25rem]"
            >
              Transform Your AI Text Into{" "}
              <span className="font-display block text-[1.15em] font-bold text-primary sm:inline sm:text-[1.2em]">
                Authentic Human Writing
              </span>
            </h1>

            <div className="mt-6 flex flex-wrap gap-4">
              {HERO_FEATURES.map((feature) => {
                const Icon = featureIcons[feature.icon];
                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-2 text-sm font-medium text-muted"
                  >
                    <Icon className="h-4 w-4 text-accent" aria-hidden />
                    {feature.label}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
              Paste in your AI draft and we rewrite it so it reads like you wrote
              it yourself. Natural flow, real voice, and writing that feels
              genuinely human.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="#humanizer" size="lg">
                Start humanizing
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button href={ROUTES.pricing} variant="ghost" size="lg">
                View plans
              </Button>
            </div>

            <ul className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {TRUST_MARKERS.map((marker) => (
                <li
                  key={marker}
                  className="flex items-center gap-2 text-sm text-muted"
                >
                  <Check className="h-4 w-4 text-accent" aria-hidden />
                  {marker}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end">
            <HumanizerPreview />
          </div>
        </div>
      </Container>
    </section>
  );
}
