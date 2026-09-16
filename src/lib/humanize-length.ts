import { countWords } from "@/lib/words";

/** Below this, the six-paragraph / gold-standard mould invents an essay. */
export const SHORT_HUMANIZE_DRAFT_WORDS = 80;

export function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function isShortHumanizeDraft(text: string): boolean {
  const words = countWords(text);
  return words > 0 && words < SHORT_HUMANIZE_DRAFT_WORDS;
}

/**
 * Cap generation so a 5–7 word draft cannot become a 300-word essay.
 * ~1.3–1.7 tokens per word, plus a small buffer for a complete sentence.
 */
export function rewriteMaxOutputTokens(wordCount: number): number {
  if (wordCount <= 0) return 512;
  if (wordCount < 20) {
    return Math.min(80, Math.max(28, Math.ceil(wordCount * 2.5) + 12));
  }
  if (wordCount < SHORT_HUMANIZE_DRAFT_WORDS) {
    return Math.min(256, Math.max(64, Math.ceil(wordCount * 1.8) + 24));
  }
  return Math.min(8192, Math.max(128, Math.ceil(wordCount * 1.7) + 48));
}

export function needsLengthRepair(input: string, output: string): boolean {
  const inWords = countWords(input);
  const outWords = countWords(output);
  if (inWords === 0 || outWords === 0) return false;
  const delta = Math.abs(outWords - inWords);
  if (inWords < 20) {
    return delta > Math.max(6, Math.ceil(inWords * 0.6));
  }
  const ratio = outWords / inWords;
  return ratio > 1.22 || ratio < 0.72;
}
