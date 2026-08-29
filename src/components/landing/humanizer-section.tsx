import { HumanizerWorkspace } from "@/components/humanizer/humanizer-workspace";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";

export function HumanizerSection() {
  return (
    <section
      id="humanizer"
      aria-labelledby="humanizer-heading"
      className="min-w-0 overflow-x-clip pb-20 sm:pb-28"
    >
      {/* Mid-gap band above the editor */}
      <div className="py-14 sm:py-20">
        <Container>
          <SectionHeader
            id="humanizer-heading"
            eyebrow="Humanizer"
            title="Revise AI-assisted drafts in the editor"
            description="Paste your draft on the left. A rewrite appears on the right after you click Humanize. Sign in is required to run a rewrite."
          />
        </Container>
      </div>

      <Container className="max-w-[90rem]">
        <HumanizerWorkspace />
      </Container>
    </section>
  );
}
