import { HumanizerDetectorMarks } from "@/components/landing/humanizer-detector-marks";
import { HumanizerWorkspace } from "@/components/humanizer/humanizer-workspace";
import { Container } from "@/components/ui/container";

export function HumanizerSection() {
  return (
    <section
      id="humanizer"
      aria-labelledby="humanizer-heading"
      className="relative min-w-0 overflow-x-clip bg-gradient-to-b from-background from-0% via-card/25 via-45% to-background to-100% py-16 sm:py-20"
    >
      <Container>
        <div className="mb-8 flex items-center justify-center gap-4 sm:mb-10">
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
          <p
            id="humanizer-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-accent"
          >
            Try the editor
          </p>
          <span
            className="h-px w-16 bg-gradient-to-r from-transparent via-accent/25 to-transparent sm:w-24"
            aria-hidden
          />
        </div>

        <HumanizerDetectorMarks />
      </Container>

      <div className="mx-auto mt-8 w-full min-w-0 max-w-[90rem] px-4 sm:mt-10 sm:px-6">
        <HumanizerWorkspace />
      </div>
    </section>
  );
}
