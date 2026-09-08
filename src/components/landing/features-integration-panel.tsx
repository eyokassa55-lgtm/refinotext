import { ChevronsDown, Link2 } from "lucide-react";
import Image from "next/image";

import { APP_LOGO_SRC, APP_NAME } from "@/lib/constants";
import { DETECTOR_MARKS, type DetectorMark } from "@/lib/detector-marks";

const GRID_ROWS: { marks: readonly DetectorMark[]; offsetClass?: string }[] = [
  { marks: DETECTOR_MARKS.slice(0, 3) },
  { marks: DETECTOR_MARKS.slice(3, 7), offsetClass: "sm:-translate-x-3" },
  { marks: DETECTOR_MARKS.slice(7, 10), offsetClass: "sm:translate-x-2" },
  { marks: DETECTOR_MARKS.slice(10, 14), offsetClass: "sm:-translate-x-1" },
];

function IntegrationTile({ src, name, iconClassName }: DetectorMark) {
  return (
    <div className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2 shadow-[0_1px_2px_rgba(15,23,20,0.03),0_8px_24px_rgba(13,92,69,0.06)]">
      <Image
        src={src}
        alt=""
        width={64}
        height={64}
        sizes="24px"
        quality={100}
        className={`h-6 w-6 shrink-0 object-contain ${iconClassName ?? ""}`}
      />
      <span className="whitespace-nowrap text-sm font-medium text-[#8f9994]">
        {name}
      </span>
    </div>
  );
}

export function FeaturesIntegrationPanel() {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-border/65 bg-card/90 p-5 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_20px_48px_rgba(26,143,106,0.12)] sm:p-6">
      <div
        className="integration-panel-aurora pointer-events-none absolute inset-0"
        aria-hidden
      />

      <div className="relative flex flex-col items-center pb-6">
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

      <div className="relative space-y-3 pb-2">
        {GRID_ROWS.map(({ marks, offsetClass }, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex flex-wrap justify-center gap-2.5 sm:gap-3 ${offsetClass ?? ""}`}
          >
            {marks.map((mark) => (
              <IntegrationTile key={mark.name} {...mark} />
            ))}
          </div>
        ))}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
