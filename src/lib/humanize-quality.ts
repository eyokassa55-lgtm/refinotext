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
  const matches = [
    ...(text.match(/"([^"]{3,})"/g) ?? []),
    ...(text.match(/“([^”]{3,})”/g) ?? []),
  ];
  return [...new Set(matches.map((item) => item.replace(/^["“]|["”]$/g, "").trim()))];
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
 * Fraction of source n-grams that also appear in the rewrite.
 * Training human_text almost never copies long phrases from ai_text.
 */
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

export function assessRewriteQuality(input: string, rawOutput: string): QualityResult {
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

  const missingQuotes = extractQuotedPhrases(input).filter((phrase) => !output.includes(phrase));
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
    ].includes(issue.code),
  );

  return {
    ok:
      blocking.length === 0 &&
      issues.filter((issue) => issue.code === "TOO_SHORT" || issue.code === "TOO_SIMILAR").length === 0,
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
    ["EMPTY", "REFUSAL", "GENERIC", "LEAK", "UNRELATED"].includes(issue.code),
  );
}
