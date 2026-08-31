import { countWords } from "@/lib/words";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "them",
  "his",
  "her",
  "their",
  "our",
  "my",
  "your",
  "not",
  "no",
  "so",
  "if",
  "then",
  "than",
  "too",
  "very",
  "just",
  "also",
  "can",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "into",
  "about",
  "over",
  "after",
  "before",
  "between",
  "through",
  "during",
  "without",
  "within",
  "because",
  "while",
  "where",
  "when",
  "what",
  "which",
  "who",
  "how",
]);

const REFUSAL_PATTERNS = [
  /^\s*(i am|i'm)\s+(sorry|unable|not able)/i,
  /^\s*i\s+(cannot|can't)\s+/i,
  /^\s*as an ai\b/i,
  /^\s*i('m| am) (a large language|an assistant)/i,
];

const GENERIC_PATTERNS = [
  /here is (your )?(the )?(rewritten|humanized|revised|refined) text/i,
  /here are the rewritten (paragraphs|versions|options|drafts)/i,
  /sure,?\s+(here('s| is)|i've)/i,
  /below is the (rewritten|revised) version/i,
  /here are (a few|several|some) (ways|options|versions)/i,
  /\*\*\s*option\s+\d+/i,
  /key changes and why/i,
];

const TEMPLATE_VOICE_PATTERNS = [
  /it is (essential|important|imperative|crucial|vital) to\b/i,
  /play(?:s)? a (crucial|vital|key|significant) role/i,
  /in (today'?s|modern) (society|world)/i,
  /\ba wide range of\b/i,
  /it is important to note/i,
  /delve into/i,
  /pave(?:s)? the way/i,
  /landscape of\b/i,
  /\bvital ecosystems\b/i,
];

const LEAK_PATTERNS = [
  /professional editor and reviser for RefinoText/i,
  /VERTEX_AI_TUNED_ENDPOINT/i,
  /GOOGLE_SERVICE_ACCOUNT/i,
  /GOOGLE_APPLICATION_CREDENTIALS/i,
  /<<<USER_TEXT>>>/i,
];

const PREFIX_PATTERNS = [
  /^(here is|here's) (your )?(the )?(rewritten|humanized|revised|refined) text:?\s*/i,
  /^here are the rewritten (paragraphs|versions|options|drafts)[^\n]{0,160}:\s*/i,
  /^(rewritten|revised|refined|humanized) text:?\s*/i,
];

export type QualityIssue = {
  code: string;
  message: string;
};

export type QualityResult = {
  ok: boolean;
  output: string;
  issues: QualityIssue[];
};

export type QualityContext = {
  retrievedPairs?: Array<{ input: string; output: string }>;
};

function uniqueWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return [...new Set(words)];
}

export function extractNumbers(text: string): string[] {
  const matches = text.match(
    /(?:[$€£]\s?)?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|(?:[$€£]\s?)\d+(?:\.\d+)?|\b\d+\.\d+\b|\b\d{4}\b|\b\d+%\b|\b\d+\b/g,
  );
  if (!matches) return [];
  return [...new Set(matches.map(normalizeNumber).filter(Boolean))];
}

function normalizeNumber(value: string): string {
  return value.replace(/[$,€£\s]/g, "").toLowerCase();
}

export function extractProperNames(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:[’'-][A-Za-z]+)*(?:\s+[A-Z][a-z]+(?:[’'-][A-Za-z]+)*)+\b/g);
  if (!matches) return [];
  return [...new Set(matches.filter((name) => !/^(The|This|That|These|Those)\b/.test(name)))];
}

export function extractQuotedPhrases(text: string): string[] {
  const normalized = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const matches = [
    ...(normalized.match(/"([^"]{3,})"/g) ?? []),
    ...(normalized.match(/'([^']{8,})'/g) ?? []),
  ];
  return [...new Set(matches.map((item) => item.replace(/^["']|["']$/g, "").trim()))];
}

function isHighlyRepetitive(text: string): boolean {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 40) return false;
  const unique = new Set(tokens);
  return unique.size / tokens.length < 0.35;
}

function normalizedTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Training human_text stays close to source length and almost never copies long phrases.
 */
export function lengthRatio(input: string, output: string): number {
  const inCount = countWords(input);
  if (inCount === 0) return 0;
  return countWords(output) / inCount;
}

export function paragraphCount(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function templateVoiceHits(text: string): number {
  return TEMPLATE_VOICE_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0,
  );
}

function significantNumbers(text: string): string[] {
  const matches = text.match(/\d+(?:\.\d+)?%|[$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d{4}\b|\b\d{3,}\b/g);
  if (!matches) return [];
  return [...new Set(matches.map((value) => value.replace(/[$,€£\s]/g, "").toLowerCase()))];
}

export function phraseCopyRatio(input: string, output: string, n = 5): number {
  const source = normalizedTokens(input);
  const rewritten = normalizedTokens(output);
  if (source.length < n + 12) return 0;

  const rewrittenPhrases = new Set<string>();
  for (let i = 0; i <= rewritten.length - n; i += 1) {
    rewrittenPhrases.add(rewritten.slice(i, i + n).join(" "));
  }

  let copied = 0;
  let total = 0;
  for (let i = 0; i <= source.length - n; i += 1) {
    total += 1;
    if (rewrittenPhrases.has(source.slice(i, i + n).join(" "))) copied += 1;
  }

  return total === 0 ? 0 : copied / total;
}

export function stripModelChrome(text: string): string {
  let output = text.replace(/^\uFEFF/, "").trim();
  if (output.startsWith("```")) {
    output = output.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
  }

  for (const pattern of PREFIX_PATTERNS) {
    output = output.replace(pattern, "");
  }

  return output.trim();
}

function retrievedFactIssues(
  input: string,
  output: string,
  retrievedPairs: Array<{ input: string; output: string }>,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceNumbers = new Set(significantNumbers(input));
  const outputNumbers = new Set(significantNumbers(output));
  const sourceNames = new Set(extractProperNames(input).map((name) => name.toLowerCase()));

  for (const pair of retrievedPairs) {
    if (pair.output === output) {
      issues.push({
        code: "COPIED_RETRIEVED",
        message: "The model returned a stored training rewrite instead of rewriting the user draft.",
      });
      break;
    }
    if (phraseCopyRatio(pair.output, output) >= 0.28 && phraseCopyRatio(input, output) < 0.5) {
      issues.push({
        code: "COPIED_RETRIEVED",
        message: "The rewrite copied too much wording from a retrieved training example.",
      });
      break;
    }
  }

  const leakedNumbers: string[] = [];
  const leakedNames: string[] = [];
  const userLower = input.toLowerCase();
  for (const pair of retrievedPairs) {
    for (const value of significantNumbers(pair.output)) {
      if (sourceNumbers.has(value)) continue;
      if (outputNumbers.has(value)) leakedNumbers.push(value);
    }
    for (const name of extractProperNames(pair.output)) {
      if (name.split(/\s+/).length < 2) continue;
      if (sourceNames.has(name.toLowerCase())) continue;
      if (name.toLowerCase().split(/\s+/).every((token) => token.length >= 4 && userLower.includes(token))) {
        continue;
      }
      if (output.includes(name)) leakedNames.push(name);
    }
  }

  if (leakedNumbers.length > 0 || leakedNames.length > 0) {
    issues.push({
      code: "RETRIEVED_FACTS",
      message: "The rewrite imported names or numbers from retrieved training examples.",
    });
  }

  return issues;
}

export function assessRewriteQuality(
  input: string,
  rawOutput: string,
  context?: QualityContext,
): QualityResult {
  const output = stripModelChrome(rawOutput);
  const issues: QualityIssue[] = [];

  if (!output) {
    issues.push({ code: "EMPTY", message: "The model returned an empty rewrite." });
    return { ok: false, output, issues };
  }

  if (REFUSAL_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push({ code: "REFUSAL", message: "The model refused instead of rewriting." });
  }

  if (GENERIC_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push({ code: "GENERIC", message: "The model returned a wrapper instead of the rewrite." });
  }

  if (LEAK_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push({ code: "LEAK", message: "The output included internal instructions." });
  }

  const inputWords = uniqueWords(input);
  const outputWords = new Set(uniqueWords(output));
  if (inputWords.length >= 8) {
    const overlap = inputWords.filter((word) => outputWords.has(word)).length;
    const ratio = overlap / inputWords.length;
    if (ratio < 0.12) {
      issues.push({ code: "UNRELATED", message: "The rewrite does not stay on the same topic." });
    }
  }

  const missingNumbers = extractNumbers(input).filter((value) => {
    const outputNumbers = new Set(extractNumbers(output));
    if (outputNumbers.has(value)) return false;
    return !output.replace(/[$,€£\s]/g, "").toLowerCase().includes(value);
  });
  if (missingNumbers.length > 0) {
    issues.push({
      code: "MISSING_FACTS",
      message: "The rewrite dropped numbers from the source.",
    });
  }

  const missingNames = extractProperNames(input).filter((name) => {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return !re.test(output);
  });
  if (missingNames.length > 0) {
    issues.push({
      code: "MISSING_NAMES",
      message: "The rewrite changed or dropped names from the source.",
    });
  }

  const missingQuotes = extractQuotedPhrases(input).filter((phrase) => {
    const haystack = output.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return !haystack.includes(phrase) && !output.includes(phrase);
  });
  if (missingQuotes.length > 0) {
    issues.push({
      code: "MISSING_QUOTES",
      message: "The rewrite dropped a quotation from the source.",
    });
  }

  const inCount = countWords(input);
  const outCount = countWords(output);
  if (inCount >= 40 && outCount < inCount * 0.55 && !isHighlyRepetitive(input)) {
    issues.push({
      code: "TOO_SHORT",
      message: "The rewrite removed too much information.",
    });
  }

  if (inCount >= 80 && phraseCopyRatio(input, output) >= 0.32) {
    issues.push({
      code: "TOO_SIMILAR",
      message: "The rewrite copied too much of the original wording.",
    });
  }

  if (inCount >= 40 && outCount > inCount * 1.35) {
    issues.push({
      code: "TOO_LONG",
      message: "The rewrite expanded the source instead of matching training length.",
    });
  }

  const inputParas = paragraphCount(input);
  const outputParas = paragraphCount(output);
  if (inCount >= 80 && inputParas >= 3 && outputParas <= 1) {
    issues.push({
      code: "PARAGRAPH_DRIFT",
      message: "The rewrite dropped the source paragraph structure.",
    });
  }

  const invented = significantNumbers(output).filter((value) => {
    const inputNumbers = new Set(significantNumbers(input));
    if (inputNumbers.has(value)) return false;
    return !input.replace(/[$,€£\s]/g, "").toLowerCase().includes(value);
  });
  if (invented.length > 0) {
    issues.push({
      code: "INVENTED_FACTS",
      message: "The rewrite introduced numbers that were not in the source.",
    });
  }

  if (templateVoiceHits(output) >= 2 && templateVoiceHits(output) > templateVoiceHits(input)) {
    issues.push({
      code: "TEMPLATE_VOICE",
      message: "The rewrite used generic template phrasing.",
    });
  }

  if (context?.retrievedPairs?.length) {
    issues.push(...retrievedFactIssues(input, output, context.retrievedPairs));
  }

  const blocking = issues.filter((issue) =>
    [
      "EMPTY",
      "REFUSAL",
      "GENERIC",
      "LEAK",
      "UNRELATED",
      "MISSING_FACTS",
      "MISSING_NAMES",
      "MISSING_QUOTES",
      "INVENTED_FACTS",
      "COPIED_RETRIEVED",
    ].includes(issue.code),
  );

  return {
    ok:
      blocking.length === 0 &&
      issues.filter((issue) =>
        [
          "TOO_SHORT",
          "TOO_SIMILAR",
          "TOO_LONG",
          "PARAGRAPH_DRIFT",
          "TEMPLATE_VOICE",
          "RETRIEVED_FACTS",
        ].includes(issue.code),
      ).length === 0,
    output,
    issues,
  };
}

export function missingFactsForRetry(input: string, output: string): string[] {
  const missing = [
    ...extractNumbers(input).filter((value) => !output.replace(/[$,€£\s]/g, "").toLowerCase().includes(value)),
    ...extractProperNames(input).filter((name) => {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return !re.test(output);
    }),
    ...extractQuotedPhrases(input).filter((phrase) => !output.includes(phrase)),
  ];
  return [...new Set(missing)].slice(0, 12);
}

export function isBlockingQualityFailure(result: QualityResult): boolean {
  return result.issues.some((issue) =>
    [
      "EMPTY",
      "REFUSAL",
      "GENERIC",
      "LEAK",
      "UNRELATED",
      "INVENTED_FACTS",
      "COPIED_RETRIEVED",
    ].includes(issue.code),
  );
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function entitiesNeedMerge(userText: string, matchedAiText: string): boolean {
  const userNumbers = sortedUnique(extractNumbers(userText));
  const matchedNumbers = sortedUnique(extractNumbers(matchedAiText));
  if (userNumbers.join("\0") !== matchedNumbers.join("\0")) return true;

  const userNames = sortedUnique(extractProperNames(userText).map((name) => name.toLowerCase()));
  const matchedNames = sortedUnique(extractProperNames(matchedAiText).map((name) => name.toLowerCase()));
  return userNames.join("\0") !== matchedNames.join("\0");
}

export function assessMergeQuality(userInput: string, template: string, rawOutput: string): QualityResult {
  const output = stripModelChrome(rawOutput);
  const issues: QualityIssue[] = [];

  if (!output) {
    issues.push({ code: "EMPTY", message: "The merger returned an empty template." });
    return { ok: false, output, issues };
  }

  if (REFUSAL_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push({ code: "REFUSAL", message: "The merger refused instead of updating values." });
  }

  if (LEAK_PATTERNS.some((pattern) => pattern.test(output))) {
    issues.push({ code: "LEAK", message: "The output included internal instructions." });
  }

  const copy = phraseCopyRatio(template, output, 4);
  if (template.trim().split(/\s+/).length >= 40 && copy < 0.55) {
    issues.push({
      code: "TEMPLATE_DRIFT",
      message: "The merger rewrote the stored template instead of updating values.",
    });
  }

  const missingNumbers = extractNumbers(userInput).filter((value) => {
    if (extractNumbers(output).includes(value)) return false;
    return !output.replace(/[$,€£\s]/g, "").toLowerCase().includes(value);
  });
  if (missingNumbers.length > 0) {
    issues.push({ code: "MISSING_FACTS", message: "The merger dropped numbers from the user draft." });
  }

  const missingNames = extractProperNames(userInput).filter((name) => {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return !re.test(output);
  });
  if (missingNames.length > 0) {
    issues.push({ code: "MISSING_NAMES", message: "The merger dropped names from the user draft." });
  }

  const blocking = issues.filter((issue) =>
    ["EMPTY", "REFUSAL", "LEAK", "TEMPLATE_DRIFT", "MISSING_FACTS", "MISSING_NAMES"].includes(issue.code),
  );

  return { ok: blocking.length === 0, output, issues };
}

function setDiff(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withThousands(value: string): string {
  const [whole, fraction] = value.split(".");
  if (!whole) return value;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction != null ? `${grouped}.${fraction}` : grouped;
}

function replaceNumberToken(text: string, fromNormalized: string, toNormalized: string): string | null {
  if (!fromNormalized || fromNormalized === toNormalized) return text;

  const fromCore = fromNormalized.endsWith("%") ? fromNormalized.slice(0, -1) : fromNormalized;
  const toCore = toNormalized.endsWith("%") ? toNormalized.slice(0, -1) : toNormalized;
  const toIsPercent = toNormalized.endsWith("%") || fromNormalized.endsWith("%");
  const variants = [...new Set([fromCore, withThousands(fromCore)].filter(Boolean))];
  let next = text;
  let replaced = false;

  for (const variant of variants) {
    const pattern = toIsPercent
      ? new RegExp(`\\b${escapeRegExp(variant)}\\s*%`, "g")
      : new RegExp(`\\b${escapeRegExp(variant)}\\b`, "g");
    if (!pattern.test(next)) continue;
    const replacement = toIsPercent ? (toNormalized.endsWith("%") ? toNormalized : `${toCore}%`) : toNormalized;
    const display = variant.includes(",") && !toIsPercent ? withThousands(toCore) : replacement;
    next = next.replace(
      toIsPercent
        ? new RegExp(`\\b${escapeRegExp(variant)}\\s*%`, "g")
        : new RegExp(`\\b${escapeRegExp(variant)}\\b`, "g"),
      display,
    );
    replaced = true;
  }

  return replaced ? next : null;
}

function replaceNameToken(text: string, from: string, to: string): string | null {
  if (!from || from.toLowerCase() === to.toLowerCase()) return text;
  const pattern = new RegExp(escapeRegExp(from), "gi");
  if (!pattern.test(text)) return null;
  return text.replace(new RegExp(escapeRegExp(from), "gi"), to);
}

/**
 * Swap a 1:1 number or name difference into the stored human_text without
 * paraphrasing. Returns null when the mapping is ambiguous.
 */
export function tryDeterministicEntityMerge(
  userText: string,
  matchedAiText: string,
  template: string,
): string | null {
  const userNumbers = extractNumbers(userText);
  const matchedNumbers = extractNumbers(matchedAiText);
  const extraUserNumbers = setDiff(userNumbers, matchedNumbers);
  const extraMatchedNumbers = setDiff(matchedNumbers, userNumbers);
  if (extraUserNumbers.length !== extraMatchedNumbers.length) return null;
  if (extraUserNumbers.length > 1) return null;

  const userNames = extractProperNames(userText);
  const matchedNames = extractProperNames(matchedAiText);
  const extraUserNames = setDiff(
    userNames.map((name) => name.toLowerCase()),
    matchedNames.map((name) => name.toLowerCase()),
  );
  const extraMatchedNames = setDiff(
    matchedNames.map((name) => name.toLowerCase()),
    userNames.map((name) => name.toLowerCase()),
  );
  if (extraUserNames.length !== extraMatchedNames.length) return null;
  if (extraUserNames.length > 1) return null;
  if (extraUserNumbers.length === 0 && extraUserNames.length === 0) return null;

  let next = template;
  if (extraUserNumbers.length === 1) {
    const replaced = replaceNumberToken(next, extraMatchedNumbers[0]!, extraUserNumbers[0]!);
    if (!replaced) return null;
    next = replaced;
  }

  if (extraUserNames.length === 1) {
    const from = matchedNames.find((name) => name.toLowerCase() === extraMatchedNames[0]);
    const to = userNames.find((name) => name.toLowerCase() === extraUserNames[0]);
    if (!from || !to) return null;
    const replaced = replaceNameToken(next, from, to);
    if (!replaced) return null;
    next = replaced;
  }

  const quality = assessMergeQuality(userText, template, next);
  return quality.ok ? next : null;
}


