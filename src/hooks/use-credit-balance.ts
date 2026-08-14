"use client";

import { useCallback, useEffect, useState } from "react";

import type { CreditBalanceResponse } from "@/types";

export function useCreditBalance(enabled: boolean) {
  const [credits, setCredits] = useState<CreditBalanceResponse | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCredits(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) {
        setCredits(null);
        return;
      }
      const data = (await res.json()) as CreditBalanceResponse;
      setCredits(data);
    } catch {
      setCredits(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const onCreditsUpdated = () => {
      void refresh();
    };

    window.addEventListener("refinotext:credits-updated", onCreditsUpdated);
    return () =>
      window.removeEventListener("refinotext:credits-updated", onCreditsUpdated);
  }, [enabled, refresh]);

  return { credits, loading, refresh };
}
