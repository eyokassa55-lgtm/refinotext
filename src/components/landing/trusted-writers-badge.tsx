import { Star } from "lucide-react";

import { TRUSTED_WRITERS_COUNT } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

type TrustedWritersBadgeProps = {
  className?: string;
};

export function TrustedWritersBadge({ className }: TrustedWritersBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-sm text-primary shadow-[0_1px_2px_rgba(15,23,20,0.05),0_10px_24px_rgba(13,92,69,0.08)]",
        className,
      )}
    >
      <Star className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <p>
        Trusted by{" "}
        <span className="font-semibold underline decoration-primary/45 underline-offset-[3px]">
          {TRUSTED_WRITERS_COUNT}
        </span>{" "}
        writers worldwide
      </p>
    </div>
  );
}
