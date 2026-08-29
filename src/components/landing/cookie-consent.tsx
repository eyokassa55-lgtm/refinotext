"use client";

import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "refinotext-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ choice: "necessary", savedAt: new Date().toISOString() }),
    );
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-4 z-50 w-[min(calc(100%-2rem),22rem)] transition-all duration-500 sm:bottom-6 sm:left-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div className="relative rounded-2xl border border-border bg-card p-5 shadow-[0_8px_40px_rgba(13,92,69,0.14)] sm:p-6">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close cookie notice"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <h2
            id="cookie-consent-title"
            className="text-base font-bold leading-snug text-foreground"
          >
            Necessary cookies
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          RefinoText uses cookies needed for the website and signed-in sessions
          (including Clerk). Polar’s checkout uses Polar’s cookies on Polar’s
          domain. We do not currently run a separate advertising cookie program
          here. Details are in the{" "}
          <Link
            href={ROUTES.privacy}
            className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          OK
        </button>
      </div>
    </div>
  );
}
