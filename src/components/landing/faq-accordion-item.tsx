"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function FaqAccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-3 py-5 text-left sm:gap-4"
      >
        <span className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-[17px]">
          {question}
        </span>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-dark/75">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-muted sm:text-[15px] sm:leading-7">
            {answer}
          </p>
        </div>
      </div>
    </article>
  );
}
