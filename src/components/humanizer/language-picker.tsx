"use client";

import { useAuth } from "@clerk/nextjs";
import { Check, ChevronDown, Globe, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { useCreditBalance } from "@/hooks/use-credit-balance";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";
import {
  hasPaidHumanizerAccess,
  isPaidHumanizeLanguage,
} from "@/lib/humanize-access";
import {
  DEFAULT_HUMANIZE_LANGUAGE,
  HUMANIZE_LANGUAGES,
  type HumanizeLanguageId,
  resolveHumanizeLanguage,
} from "@/lib/humanize-languages";
import { cn } from "@/lib/utils";

type LanguagePickerProps = {
  value: HumanizeLanguageId;
  onChange: (id: HumanizeLanguageId) => void;
};

type LanguagePickerInnerProps = LanguagePickerProps & {
  paidUnlocked: boolean;
  upgradeHref: string;
};

export function LanguagePicker(props: LanguagePickerProps) {
  if (!isClerkEnabled) {
    return (
      <LanguagePickerInner
        {...props}
        paidUnlocked
        upgradeHref={ROUTES.pricing}
      />
    );
  }

  return <LanguagePickerWithAuth {...props} />;
}

function LanguagePickerWithAuth(props: LanguagePickerProps) {
  const { isSignedIn } = useAuth();
  const { credits } = useCreditBalance(Boolean(isSignedIn));
  const paidUnlocked = hasPaidHumanizerAccess(credits?.plan);

  return (
    <LanguagePickerInner
      {...props}
      paidUnlocked={paidUnlocked}
      upgradeHref={isSignedIn ? ROUTES.pricing : ROUTES.signIn}
    />
  );
}

function LanguagePickerInner({
  value,
  onChange,
  paidUnlocked,
  upgradeHref,
}: LanguagePickerInnerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const router = useRouter();
  const selected = resolveHumanizeLanguage(value);

  useEffect(() => {
    if (paidUnlocked) return;
    if (isPaidHumanizeLanguage(value)) onChange(DEFAULT_HUMANIZE_LANGUAGE);
  }, [onChange, paidUnlocked, value]);

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
              const locked =
                !paidUnlocked && isPaidHumanizeLanguage(language.id);
              return (
                <li key={language.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={
                      locked
                        ? `${language.nativeName} (locked — upgrade to unlock)`
                        : language.nativeName
                    }
                    title={
                      locked
                        ? "Upgrade to unlock this language"
                        : language.englishName
                    }
                    onClick={() => {
                      if (locked) {
                        setOpen(false);
                        router.push(upgradeHref);
                        return;
                      }
                      onChange(language.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                      locked
                        ? "text-muted hover:bg-mint-dark/60"
                        : isSelected
                          ? "bg-mint-dark text-foreground"
                          : "text-foreground hover:bg-mint-dark/60",
                    )}
                  >
                    <span>{language.nativeName}</span>
                    {locked ? (
                      <Lock className="h-4 w-4 opacity-70" aria-hidden />
                    ) : isSelected ? (
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
