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
  size = 24,
  showWordmark = true,
  priority = false,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      aria-label={APP_NAME}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <Image
        src={APP_LOGO_SRC}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority={priority}
      />
      {showWordmark ? (
        <span className="truncate text-xl font-bold tracking-tight text-foreground">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
