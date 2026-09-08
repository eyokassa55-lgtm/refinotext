import {
  DetectorMarkItem,
  DetectorMarksMarquee,
} from "@/components/landing/detector-marks-marquee";
import {
  DETECTOR_MARKS,
  DETECTOR_MARKS_ROW_ONE,
  DETECTOR_MARKS_ROW_TWO,
} from "@/lib/detector-marks";

function DetectorMarksStaticRows() {
  return (
    <div className="hidden flex-col items-center gap-5 md:flex">
      <ul className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-3 lg:flex-nowrap lg:gap-x-4 xl:gap-x-5">
        {DETECTOR_MARKS_ROW_ONE.map((mark) => (
          <DetectorMarkItem key={mark.name} {...mark} size="mid" />
        ))}
      </ul>

      <ul className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-3 lg:gap-x-4 xl:gap-x-5">
        {DETECTOR_MARKS_ROW_TWO.map((mark) => (
          <DetectorMarkItem key={mark.name} {...mark} size="mid" />
        ))}
      </ul>
    </div>
  );
}

function DetectorMarksMobileMarquee() {
  return (
    <div className="space-y-3 sm:space-y-4 md:hidden">
      <DetectorMarksMarquee
        marks={DETECTOR_MARKS_ROW_ONE}
        durationSec={42}
        variant="plain"
        size="mid"
      />
      <DetectorMarksMarquee
        marks={DETECTOR_MARKS_ROW_TWO}
        reverse
        durationSec={34}
        variant="plain"
        size="mid"
      />
    </div>
  );
}

export function HumanizerDetectorMarks() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6">
      <p className="mb-5 text-center font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f9994] sm:mb-6 sm:text-[11px]">
        Our AI passes industry standard detectors
      </p>

      <p className="sr-only">
        Supported detectors include{" "}
        {DETECTOR_MARKS.map((mark) => mark.name).join(", ")}.
      </p>

      <DetectorMarksStaticRows />
      <DetectorMarksMobileMarquee />
    </div>
  );
}
