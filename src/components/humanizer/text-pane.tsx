"use client";

import { ClipboardPaste, FileText, Loader2 } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";

type TextPaneProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder: string;
  readOnly?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onPasteClick?: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

export function TextPane({
  id,
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  onPasteClick,
  textareaRef,
}: TextPaneProps) {
  const showEmptyState = !readOnly && !value && !isLoading;

  return (
    <div className="flex min-h-0 flex-col">
      <label htmlFor={id} className="mb-2 text-sm font-semibold text-foreground">
        {label}
      </label>

      <div
        className={cn(
          "relative flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border bg-card",
          isLoading ? "border-accent/40" : "border-border",
        )}
      >
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          aria-busy={isLoading}
          placeholder={showEmptyState ? "" : placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className={cn(
            "min-h-[280px] flex-1 resize-y bg-transparent p-4 pb-12 text-sm leading-relaxed text-foreground placeholder:text-muted/60 focus-visible:outline-none",
            readOnly && "bg-mint-dark/20",
          )}
        />

        {showEmptyState && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light text-primary">
              <FileText className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                {emptyDescription}
              </p>
            </div>
            {onPasteClick && (
              <button
                type="button"
                onClick={onPasteClick}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                Paste text
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">Refining your text…</p>
            <p className="text-xs text-muted">This may take a few seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}
