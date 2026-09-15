export const HUMANIZE_DETECTOR_IDS = [
  "academic-turnitin",
  "gptzero",
  "zerogpt",
] as const;

export type HumanizeDetectorId = (typeof HUMANIZE_DETECTOR_IDS)[number];

export const DEFAULT_HUMANIZE_DETECTOR: HumanizeDetectorId = "academic-turnitin";

export function isAcademicTurnitinDetector(detector?: string | null): boolean {
  return detector === "academic-turnitin";
}

export function isGptZeroDetector(detector?: string | null): boolean {
  return detector === "gptzero";
}

export function isZeroGptDetector(detector?: string | null): boolean {
  return detector === "zerogpt";
}
