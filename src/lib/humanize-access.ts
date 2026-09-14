import { resolveHumanizeLanguage } from "@/lib/humanize-languages";

export type BillingPlan = "FREE" | "BASIC" | "PRO" | "ULTRA";

const FREE_STYLE_ALIASES = new Set(["", "auto", "standard"]);
const FREE_HUMANIZE_LANGUAGES = new Set(["en", "es"]);

export function hasPaidHumanizerAccess(plan?: string | null): boolean {
  return plan === "BASIC" || plan === "PRO" || plan === "ULTRA";
}

/** Auto is free. Every other writing style requires a paid plan. */
export function isPaidWritingStyle(tone?: string | null): boolean {
  const key = tone?.trim().toLowerCase() ?? "";
  return !FREE_STYLE_ALIASES.has(key);
}

/** English and Spanish are free. Every other rewrite language requires a paid plan. */
export function isPaidHumanizeLanguage(language?: string | null): boolean {
  const key = language?.trim().toLowerCase() ?? "";
  if (!key || FREE_HUMANIZE_LANGUAGES.has(key)) return false;
  const resolved = resolveHumanizeLanguage(key);
  return !FREE_HUMANIZE_LANGUAGES.has(resolved.id);
}
