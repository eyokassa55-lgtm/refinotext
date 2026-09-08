import { ChevronsDown, Link2 } from "lucide-react";
import Image from "next/image";

import { DetectorMarksMarquee } from "@/components/landing/detector-marks-marquee";
import { APP_LOGO_SRC, APP_NAME } from "@/lib/constants";
import {
  DETECTOR_MARKS_ROW_ONE,
  DETECTOR_MARKS_ROW_TWO,
} from "@/lib/detector-marks";

export function DetectorIntegrationPanel() {
  const rowOneLeft = DETECTOR_MARKS_ROW_ONE.slice(0, 5);
  const rowOneRight = DETECTOR_MARKS_ROW_ONE.slice(5);

  return (
    <div className="integration-panel relative overflow-hidden rounded-2xl border-2 border-border/65 bg-card/90 p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_20px_48px_rgba(26,143,106,0.12)] sm:p-6">
      <div
        className="integration-panel-aurora pointer-events-none absolute inset-0"
        aria-hidden
      />

      <div className="relative flex flex-col items-center pb-5">
        <div className="integration-hub-float relative">
          <div
            className="absolute -inset-4 rounded-2xl bg-accent/15 blur-2xl"
            aria-hidden
          />
          <div className="relative inline-flex items-center gap-3 rounded-2xl border border-border/60 bg-mint-dark/70 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <Image
              src={APP_LOGO_SRC}
              alt=""
              width={64}
              height={64}
              sizes="56px"
              quality={100}
              className="h-12 w-12 scale-[1.45] object-contain"
            />
            <span className="text-base font-semibold tracking-tight text-foreground">
              {APP_NAME}
            </span>
            <Link2 className="h-4 w-4 text-muted/45" aria-hidden />
          </div>
        </div>

        <ChevronsDown
          className="integration-chevron-bounce mt-4 h-5 w-5 text-muted/45"
          aria-hidden
        />
      </div>

      <div className="relative space-y-3">
        <DetectorMarksMarquee marks={rowOneLeft} durationSec={34} />
        <DetectorMarksMarquee marks={rowOneRight} reverse durationSec={30} />
        <DetectorMarksMarquee marks={DETECTOR_MARKS_ROW_TWO} durationSec={36} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
