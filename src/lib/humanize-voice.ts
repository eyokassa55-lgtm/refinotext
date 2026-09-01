import { countWords } from "@/lib/words";

/** Phrases the model must avoid in rewrites. */
export const BANNED_AI_PHRASE_PATTERNS: RegExp[] = [
  /\bultimately\b/i,
  /\bfurthermore\b/i,
  /\bmoreover\b/i,
  /\bin conclusion\b/i,
  /\badditionally\b/i,
  /\bconsequently\b/i,
  /\bunlock\b/i,
  /\bunleash\b/i,
  /\bdelve\b/i,
  /\btestament\b/i,
  /\bparamount\b/i,
  /\bunderscore\b/i,
  /\bpivotal\b/i,
  /\blandscape\b/i,
  /\brealm\b/i,
  /\bintricate\b/i,
  /\bdynamic\b/i,
  /\bbeacon\b/i,
  /\btapestry\b/i,
];

export const TEMPLATE_VOICE_PATTERNS: RegExp[] = [
  /it is (essential|important|imperative|crucial|vital) to\b/i,
  /play(?:s)? a (crucial|vital|key|significant) role/i,
  /in (today'?s|modern) (society|world)/i,
  /\ba wide range of\b/i,
  /it is important to note/i,
  /delve into/i,
  /pave(?:s)? the way/i,
  /landscape of\b/i,
  /\bvital ecosystems\b/i,
  /\bequates to\b/i,
  /\bfacilitate progress\b/i,
  /\balong the (?:path|way)\b/i,
  /\binevitably encounter\b/i,
  /\bkey component(?:s)? of\b/i,
  /\bmajor life aspiration\b/i,
  /\bfor some[,;]?\s+/i,
  /\bsome people\b[\s\S]{0,160}\bothers\b/i,
  /\bplays a vital role\b/i,
  /\bgrowth-oriented perspective\b/i,
  /\bnavigate the complexities\b/i,
];

export function findBannedAiPhrases(text: string): string[] {
  const found: string[] = [];
  for (const pattern of BANNED_AI_PHRASE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) found.push(match[0].toLowerCase());
  }
  return [...new Set(found)];
}

export function templateVoiceHits(text: string): number {
  return TEMPLATE_VOICE_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0,
  );
}

export function hasParallelForSomeOthers(text: string): boolean {
  return (
    /\bfor some\b[\s\S]{0,180}\b(for others|others find|others may)\b/i.test(text) ||
    /\bsome people\b[\s\S]{0,180}\bothers\b/i.test(text)
  );
}

export function isTemplateLikeOutput(text: string, input?: string): boolean {
  const banned = findBannedAiPhrases(text);
  if (banned.length >= 1) return true;

  const hits = templateVoiceHits(text);
  const inputHits = input ? templateVoiceHits(input) : 0;
  if (hits >= 2 && hits >= inputHits) return true;
  if (hasParallelForSomeOthers(text)) return true;

  return false;
}

export function rewriteArtificialityScore(text: string, input?: string): number {
  const banned = findBannedAiPhrases(text).length;
  const template = Math.max(0, templateVoiceHits(text) - (input ? templateVoiceHits(input) : 0));
  const parallel = hasParallelForSomeOthers(text) ? 2 : 0;
  return banned * 3 + template + parallel;
}

export function looksLikeGenericEssay(text: string): boolean {
  const words = countWords(text);
  if (words < 70) return false;

  const topicLike =
    /\b(success|education|technology|discipline|time is|happiness|leadership|environment)\b/i.test(
      text,
    );
  const formal =
    templateVoiceHits(text) >= 1 ||
    hasParallelForSomeOthers(text) ||
    /\bindividuals\b/i.test(text);

  return topicLike && formal;
}
