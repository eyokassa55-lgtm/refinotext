import Link from "next/link";

import { Container } from "@/components/ui/container";

export function AnnouncementBar() {
  return (
    <div className="relative overflow-x-clip border-b border-border/60 bg-card/80 backdrop-blur-sm">
      <Container className="flex min-h-[36px] min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2 text-xs text-muted">
        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-2 text-center">
          <span className="shrink-0 rounded-md border border-border bg-mint px-2 py-0.5 font-semibold text-foreground">
            V1.0
          </span>
          <span className="min-w-0 text-pretty">
            Qualitative Motion Engine — RefinoText writing revision is live.
          </span>
        </div>
        <Link
          href="#humanizer"
          className="font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          Open editor
        </Link>
      </Container>
    </div>
  );
}
