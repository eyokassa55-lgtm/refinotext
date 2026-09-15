import type { HumanizeDetectorId } from "@/lib/humanize-detectors";

export const DETECTOR_TOUR_STORAGE_KEY = "refinotext:detector-tour-done";
export const DETECTOR_TOUR_WELCOME_PARAM = "welcome";
export const DETECTOR_TOUR_NEW_USER_MS = 24 * 60 * 60 * 1000;

export type DetectorTourStep = {
  id: HumanizeDetectorId;
  title: string;
  subtitle: string;
  body: string;
  callout: string;
  footer?: string;
};

export const DETECTOR_TOUR_STEPS = [
  {
    id: "academic-turnitin",
    title: "Academic Mode (Turnitin)",
    subtitle: "Our most powerful academic rewrite",
    body: "Specially designed for academic writing. This mode is tuned for Turnitin, Copyleaks, and other academic checkers.",
    callout: "Recommended for: Students, researchers, and academic papers",
    footer: "This is our default mode and works best for most use cases.",
  },
  {
    id: "gptzero",
    title: "GPTZero Mode",
    subtitle: "Optimized for GPTZero-style checkers",
    body: "This mode uses the professional gold-standard rewrite — a different rhythm from the academic mould.",
    callout: "Best for: Drafts you expect to run through GPTZero",
  },
  {
    id: "zerogpt",
    title: "ZeroGPT Mode",
    subtitle: "Optimized for ZeroGPT-style checkers",
    body: "This mode uses the same lock-pass academic mould as Academic (Turnitin), aimed at ZeroGPT-style checkers.",
    callout: "Best for: Content that will be checked with ZeroGPT or similar tools",
  },
] as const satisfies ReadonlyArray<DetectorTourStep>;

export function hasCompletedDetectorTour(
  storage: Pick<Storage, "getItem"> | null | undefined,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(DETECTOR_TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDetectorTourComplete(
  storage: Pick<Storage, "setItem"> | null | undefined,
): void {
  try {
    storage?.setItem(DETECTOR_TOUR_STORAGE_KEY, "1");
  } catch {
    // Ignore private-mode / blocked storage.
  }
}

export function shouldStartDetectorTour({
  isSignedIn,
  createdAt,
  welcomeParam,
  tourDone,
  now = Date.now(),
}: {
  isSignedIn: boolean;
  createdAt?: Date | string | number | null;
  welcomeParam?: string | null;
  tourDone: boolean;
  now?: number;
}): boolean {
  if (!isSignedIn || tourDone) return false;
  if (welcomeParam === "1") return true;
  if (createdAt == null) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs) || createdMs > now) return false;
  return now - createdMs <= DETECTOR_TOUR_NEW_USER_MS;
}

export function stripWelcomeParamFromUrl(href: string): string {
  const url = new URL(href, "https://refinotext.com");
  url.searchParams.delete(DETECTOR_TOUR_WELCOME_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
