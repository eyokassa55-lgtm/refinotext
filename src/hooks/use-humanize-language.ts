"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_HUMANIZE_LANGUAGE,
  type HumanizeLanguageId,
  resolveHumanizeLanguage,
} from "@/lib/humanize-languages";

export const HUMANIZE_LANGUAGE_STORAGE_KEY = "refinotext:language";
export const HUMANIZE_LANGUAGE_EVENT = "refinotext:language-updated";

function readStoredLanguage(): HumanizeLanguageId {
  if (typeof window === "undefined") return DEFAULT_HUMANIZE_LANGUAGE;
  try {
    return resolveHumanizeLanguage(
      window.localStorage.getItem(HUMANIZE_LANGUAGE_STORAGE_KEY),
    ).id;
  } catch {
    return DEFAULT_HUMANIZE_LANGUAGE;
  }
}

export function useHumanizeLanguage() {
  const [language, setLanguageState] = useState<HumanizeLanguageId>(
    DEFAULT_HUMANIZE_LANGUAGE,
  );

  useEffect(() => {
    setLanguageState(readStoredLanguage());

    const onUpdate = () => {
      setLanguageState(readStoredLanguage());
    };

    window.addEventListener(HUMANIZE_LANGUAGE_EVENT, onUpdate);
    return () => window.removeEventListener(HUMANIZE_LANGUAGE_EVENT, onUpdate);
  }, []);

  const setLanguage = useCallback((id: HumanizeLanguageId) => {
    const next = resolveHumanizeLanguage(id).id;
    setLanguageState(next);
    try {
      window.localStorage.setItem(HUMANIZE_LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore quota / private-mode failures
    }
    window.dispatchEvent(new Event(HUMANIZE_LANGUAGE_EVENT));
  }, []);

  return { language, setLanguage };
}
