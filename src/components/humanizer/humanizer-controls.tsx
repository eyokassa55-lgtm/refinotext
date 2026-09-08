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
    "w-full shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold tracking-tight lg:w-auto";

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
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Sign in to Humanize
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
          className={buttonClass}
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
  );
}
