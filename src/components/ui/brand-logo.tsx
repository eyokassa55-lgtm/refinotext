import Image from "next/image";
import Link from "next/link";

import { APP_LOGO_SRC, APP_NAME, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: number;
  showWordmark?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  href = ROUTES.home,
  className,
  size,
  showWordmark = true,
  priority = false,
}: BrandLogoProps) {
  const markSize = size ?? (showWordmark ? 34 : 52);

  return (
    <Link
      href={href}
      aria-label={APP_NAME}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: markSize, height: markSize }}
      >
        <Image
          src={APP_LOGO_SRC}
          alt=""
          width={128}
          height={128}
          sizes={`${markSize}px`}
          quality={100}
          className="h-full w-full object-contain"
          priority={priority}
        />
      </span>
      {showWordmark ? (
        <span className="truncate text-2xl font-bold leading-none tracking-[-0.03em] text-foreground">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
