import { cn } from "@/lib/utils";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "nav";
  id?: string;
  ariaLabel?: string;
};

export function Container({
  children,
  className,
  as: Tag = "div",
  id,
  ariaLabel,
}: ContainerProps) {
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
    >
      {children}
    </Tag>
  );
}
