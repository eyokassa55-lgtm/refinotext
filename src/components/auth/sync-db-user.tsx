"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { isClerkEnabled } from "@/lib/auth-config";

export function SyncDbUser() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  useEffect(() => {
    if (!isClerkEnabled || !isLoaded || !isSignedIn || !userId) return;

    let cancelled = false;

    const sync = async (attempt = 0) => {
      try {
        const token = await getToken();
        const res = await fetch("/api/account/sync", {
          method: "POST",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok || cancelled) return;
      } catch {
        // Retry below.
      }
      if (!cancelled && attempt < 5) {
        window.setTimeout(() => {
          void sync(attempt + 1);
        }, 600 * (attempt + 1));
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, userId]);

  return null;
}
