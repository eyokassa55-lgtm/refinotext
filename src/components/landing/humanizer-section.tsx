import { HumanizerDetectorMarks } from "@/components/landing/humanizer-detector-marks";
import { HumanizerWorkspace } from "@/components/humanizer/humanizer-workspace";
import { Container } from "@/components/ui/container";

export function HumanizerSection() {
  return (
    <section
      id="humanizer"
      aria-labelledby="humanizer-heading"
      className="relative min-w-0 overflow-x-clip bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="mb-8 flex items-center justify-center sm:mb-10">
          <p
            id="humanizer-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-accent"
          >
            Try the editor
          </p>
        </div>

        <HumanizerDetectorMarks />
      </Container>

      <div className="mx-auto mt-8 w-full min-w-0 max-w-[90rem] px-4 sm:mt-10 sm:px-6">
        <HumanizerWorkspace />
      </div>
    </section>
  );
}
