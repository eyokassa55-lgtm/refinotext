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
  return (
    <div
      className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
      aria-label="Humanize"
    >
      <div className="flex justify-end">
        {isClerkEnabled ? (
          <>
            <Show when="signed-out">
              <Button
                href={ROUTES.signIn}
                className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:w-auto"
                size="sm"
                ariaLabel="Sign in to humanize"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Sign in to Humanize
              </Button>
            </Show>
            <Show when="signed-in">
              <Button
                onClick={onRefine}
                disabled={disabled || isLoading}
                className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:w-auto"
                size="sm"
                ariaLabel="Humanize text now"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                )}
                {isLoading ? "Humanizing..." : "Humanize"}
              </Button>
            </Show>
          </>
        ) : (
          <Button
            onClick={onRefine}
            disabled={disabled || isLoading}
            className="w-full shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover lg:w-auto"
            size="sm"
            ariaLabel="Humanize text now"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {isLoading ? "Humanizing..." : "Humanize"}
          </Button>
        )}
      </div>
    </div>
  );
}
