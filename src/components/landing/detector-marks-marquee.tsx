import Image from "next/image";

import type { DetectorMark } from "@/lib/detector-marks";
import { cn } from "@/lib/utils";

type MarkSize = "mini" | "mid" | "lg";

type DetectorMarksMarqueeProps = {
  marks: readonly DetectorMark[];
  reverse?: boolean;
  durationSec?: number;
  variant?: "card" | "plain";
  size?: MarkSize;
};

const PLAIN_SIZE_STYLES: Record<
  MarkSize,
  { icon: string; text: string; item: string }
> = {
  mini: {
    icon: "h-4 w-4",
    text: "text-[10px] font-bold leading-none tracking-normal text-[#8f9994]",
    item: "gap-2 px-1.5",
  },
  mid: {
    icon: "h-5 w-5 md:h-6 md:w-6",
    text: "text-[11px] font-bold leading-none tracking-normal text-[#8f9994] sm:text-[12px] md:text-[13px]",
    item: "gap-2 px-2 sm:gap-2.5 sm:px-2.5 md:gap-3 md:px-3",
  },
  lg: {
    icon: "h-6 w-6 sm:h-7 sm:w-7",
    text: "text-[13px] font-bold leading-none tracking-normal text-[#7a8580] sm:text-[15px]",
    item: "gap-2.5 px-2 sm:gap-3 sm:px-3",
  },
};

function MarkTile({
  src,
  name,
  iconClassName,
  variant = "card",
  size = "lg",
}: DetectorMark & { variant?: "card" | "plain"; size?: MarkSize }) {
  const plainStyles = PLAIN_SIZE_STYLES[size];

  return (
    <li
      className={cn(
        "inline-flex shrink-0 items-center",
        variant === "card"
          ? "gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2 shadow-[0_1px_2px_rgba(15,23,20,0.03)]"
          : plainStyles.item,
      )}
    >
      <Image
        src={src}
        alt=""
        width={64}
        height={64}
        sizes="28px"
        quality={100}
        className={cn(
          "shrink-0 object-contain",
          variant === "card" ? "h-6 w-6" : plainStyles.icon,
          iconClassName,
        )}
      />
      <span
        className={cn(
          "whitespace-nowrap font-sans",
          variant === "card"
            ? "text-sm font-medium leading-none text-muted"
            : plainStyles.text,
        )}
      >
        {name}
      </span>
    </li>
  );
}

export function DetectorMarksMarquee({
  marks,
  reverse = false,
  durationSec = 36,
  variant = "card",
  size = "lg",
}: DetectorMarksMarqueeProps) {
  const loop = [...marks, ...marks];

  return (
    <div className="detector-marquee-mask w-full min-w-0">
      <ul
        className={cn(
          "detector-marquee-track flex w-max gap-2.5 sm:gap-3",
          reverse && "detector-marquee-reverse",
        )}
        style={{ animationDuration: `${durationSec}s` }}
        aria-hidden
      >
        {loop.map((mark, index) => (
          <MarkTile
            key={`${mark.name}-${index}`}
            {...mark}
            variant={variant}
            size={size}
          />
        ))}
      </ul>
    </div>
  );
}

export function DetectorMarkItem({
  src,
  name,
  iconClassName,
  size = "lg",
}: DetectorMark & { size?: MarkSize }) {
  return (
    <MarkTile
      src={src}
      name={name}
      iconClassName={iconClassName}
      variant="plain"
      size={size}
    />
  );
}
