import { INTENSITY_LABELS } from "@/lib/landing-data";

export { countCharacters, countWords } from "@/lib/words";

export function getIntensityLabel(value: number): string {
  const match = INTENSITY_LABELS.find(
    (label) => value >= label.min && value <= label.max,
  );
  return match?.name ?? "Balanced";
}

export type HumanizerErrorCode =
  | "empty"
  | "clipboard"
  | "copy"
  | "not_connected";

export const HUMANIZER_ERRORS: Record<HumanizerErrorCode, string> = {
  empty: "Please paste or type some text before refining.",
  clipboard:
    "Clipboard access was blocked. Allow paste permission or paste with Ctrl+V.",
  copy: "Could not copy to clipboard. Select the text and copy manually.",
  not_connected:
    "The humanizer engine is not connected yet. Refine will be available in the next step.",
};
