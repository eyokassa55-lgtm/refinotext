export type BillingPlan = "FREE" | "BASIC" | "PRO" | "ULTRA";

const FREE_STYLE_ALIASES = new Set(["", "auto", "standard"]);

export function hasPaidHumanizerAccess(plan?: string | null): boolean {
  return plan === "BASIC" || plan === "PRO" || plan === "ULTRA";
}

/** Auto is free. Every other writing style requires a paid plan. */
export function isPaidWritingStyle(tone?: string | null): boolean {
  const key = tone?.trim().toLowerCase() ?? "";
  return !FREE_STYLE_ALIASES.has(key);
}

/** Ultra Mode sends intensity 100. */
export function isUltraIntensity(intensity?: number | null): boolean {
  return (intensity ?? 0) >= 100;
}
