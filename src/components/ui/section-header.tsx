import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  id?: string;
  tone?: "light" | "dark";
  titleWeight?: "bold" | "medium";
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  id,
  tone = "light",
  titleWeight = "bold",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className={cn(
          "text-3xl tracking-tight sm:text-4xl",
          titleWeight === "bold" ? "font-bold" : "font-medium",
          tone === "dark" && "text-white",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            tone === "dark" ? "text-white/60" : "text-muted",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
