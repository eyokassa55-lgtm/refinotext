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
  size = 52,
  showWordmark = true,
  priority = false,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      aria-label={APP_NAME}
      className={cn(
        "inline-flex min-w-0 items-center gap-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-visible"
        style={{ width: size, height: size }}
      >
        <Image
          src={APP_LOGO_SRC}
          alt=""
          width={128}
          height={128}
          sizes={`${Math.round(size * 1.5)}px`}
          quality={100}
          className="h-full w-full scale-[1.45] object-contain bg-transparent"
          priority={priority}
        />
      </span>
      {showWordmark ? (
        <span className="-ml-1.5 truncate text-2xl font-bold leading-none tracking-[-0.03em] text-foreground sm:-ml-2">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
