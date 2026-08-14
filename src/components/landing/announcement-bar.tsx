import Link from "next/link";

import { Container } from "@/components/ui/container";
import { APP_NAME } from "@/lib/constants";

export function AnnouncementBar() {
  return (
    <div className="border-b border-border/60 bg-card/80 backdrop-blur-sm relative">
      <Container className="flex items-center justify-center py-2 text-xs text-muted relative min-h-[36px]">
        <div className="flex items-center gap-2 text-center">
          <span className="rounded-md border border-border bg-mint px-2 py-0.5 font-semibold text-foreground">
            V1.0
          </span>
          <span>
            Qualitative Motion Engine — {APP_NAME} AI Humanizer now live.
          </span>
        </div>
        <Link
          href="#humanizer"
          className="absolute right-4 sm:right-6 font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          Try Humanizer →
        </Link>
      </Container>
    </div>
  );
}
