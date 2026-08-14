import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "dark" | "outline";
  className?: string;
};

const variants = {
  default: "bg-card text-foreground border border-border",
  accent: "bg-accent-light text-primary border border-accent/20",
  dark: "bg-card-dark text-accent border border-white/10",
  outline: "bg-transparent text-muted border border-border",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
