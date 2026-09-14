"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import {
  HUMANIZE_LANGUAGES,
  type HumanizeLanguageId,
  resolveHumanizeLanguage,
} from "@/lib/humanize-languages";
import { cn } from "@/lib/utils";

type LanguagePickerProps = {
  value: HumanizeLanguageId;
  onChange: (id: HumanizeLanguageId) => void;
};

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected = resolveHumanizeLanguage(value);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Language: ${selected.nativeName}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span>{selected.code}</span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Select language"
          style={menuStyle}
          className="z-[80] w-56 rounded-2xl border border-border/70 bg-white p-2 shadow-[0_12px_40px_rgba(15,23,20,0.14)]"
        >
          <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
            Select language
          </p>
          <ul className="flex flex-col">
            {HUMANIZE_LANGUAGES.map((language) => {
              const isSelected = language.id === selected.id;
              return (
                <li key={language.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(language.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-mint-dark text-foreground"
                        : "text-foreground hover:bg-mint-dark/60",
                    )}
                  >
                    <span>{language.nativeName}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
