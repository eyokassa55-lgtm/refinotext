/**
 * Canonical word counter for RefinoText.
 * 1 word = 1 credit, so this is the single source of truth for billing.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countCharacters(text: string): number {
  return text.length;
}
