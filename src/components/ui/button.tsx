import Link from "next/link";

import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
};

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_1px_2px_rgba(13,92,69,0.18),0_8px_20px_rgba(13,92,69,0.16)] hover:shadow-[0_2px_8px_rgba(13,92,69,0.22)]",
  secondary:
    "bg-card text-foreground border border-border/80 shadow-[0_1px_2px_rgba(15,23,20,0.04)] hover:bg-mint-dark hover:shadow-sm",
  ghost: "text-foreground hover:bg-mint-dark/60",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-card",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  onClick,
  type = "button",
  disabled,
  ariaLabel,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    const isExternal = /^(https?:|mailto:)/i.test(href);
    if (isExternal) {
      return (
        <a href={href} className={classes} aria-label={ariaLabel}>
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  );
}
