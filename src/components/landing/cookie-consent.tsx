"use client";

import Link from "next/link";
import { Cookie, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "refinotext-cookie-consent";

type ConsentChoice = "all" | "necessary" | "custom";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveChoice = (choice: ConsentChoice) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        choice,
        analytics: choice === "all" ? true : choice === "necessary" ? false : analytics,
        marketing: choice === "all" ? true : choice === "necessary" ? false : marketing,
        savedAt: new Date().toISOString(),
      }),
    );
    setVisible(false);
  };

  const handleClose = () => {
    saveChoice("necessary");
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
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close cookie consent"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <h2
            id="cookie-consent-title"
            className="text-base font-bold leading-snug text-foreground"
          >
            We value your privacy
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          We use cookies to enhance your browsing experience, serve personalized
          content, and analyze our traffic. By clicking &ldquo;Accept All&rdquo;, you
          consent to our use of cookies. Read our{" "}
          <Link
            href={ROUTES.privacy}
            className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            Privacy Policy
          </Link>
          .
        </p>

        {showCustomize && (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-mint/50 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="text-foreground">Analytics cookies</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="text-foreground">Marketing cookies</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
            </label>
            <button
              type="button"
              onClick={() => saveChoice("custom")}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Save preferences
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => saveChoice("all")}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Accept All
          </button>

          <button
            type="button"
            onClick={() => saveChoice("necessary")}
            className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-colors hover:bg-mint-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Necessary Only
          </button>

          <button
            type="button"
            onClick={() => setShowCustomize((prev) => !prev)}
            className="inline-flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Customize
          </button>
        </div>
      </div>
    </div>
  );
}
