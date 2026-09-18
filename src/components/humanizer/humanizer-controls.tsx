"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Show } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";

type HumanizerControlsProps = {
  onRefine: () => void;
  isLoading: boolean;
  disabled: boolean;
};

export function HumanizerControls({
  onRefine,
  isLoading,
  disabled,
}: HumanizerControlsProps) {
  const buttonClass =
    "w-full shrink-0 rounded-full bg-[#0F634A] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,99,74,0.28),0_8px_18px_rgba(15,99,74,0.22)] hover:brightness-110 hover:bg-[#0F634A] lg:w-auto";

  return (
    <div className="flex justify-end" aria-label="Humanize">
      {isClerkEnabled ? (
        <>
          <Show when="signed-out">
            <Button
              href={ROUTES.signIn}
              className={buttonClass}
              size="sm"
              ariaLabel="Sign in to humanize"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Humanize Text
              <kbd className="inline-flex items-center rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white/95">
                Ctrl+↵
              </kbd>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button
              onClick={onRefine}
              disabled={disabled || isLoading}
              className={buttonClass}
              size="sm"
              ariaLabel="Humanize text now"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              )}
              {isLoading ? "Humanizing..." : "Humanize Text"}
              {isLoading ? null : (
                <kbd className="inline-flex items-center rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white/95">
                  Ctrl+↵
                </kbd>
              )}
            </Button>
          </Show>
        </>
      ) : (
        <Button
          onClick={onRefine}
          disabled={disabled || isLoading}
          className={buttonClass}
          size="sm"
          ariaLabel="Humanize text now"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          {isLoading ? "Humanizing..." : "Humanize Text"}
          {isLoading ? null : (
            <kbd className="inline-flex items-center rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white/95">
              Ctrl+↵
            </kbd>
          )}
        </Button>
      )}
    </div>
  );
}
