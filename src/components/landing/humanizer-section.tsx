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
            title="Refine AI text into authentic writing"
            description="Paste your draft on the left. Humanized writing appears in the output pane on the right after you click Humanize Text Now."
          />
        </Container>
      </div>

      <Container className="max-w-[90rem]">
        <HumanizerWorkspace />
      </Container>
    </section>
  );
}
