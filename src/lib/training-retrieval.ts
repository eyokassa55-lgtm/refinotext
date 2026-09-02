import "server-only";

import { paragraphCount, phraseCopyRatio } from "@/lib/humanize-quality";
import { findExactTrainingMatch, findNormalizedTrainingMatch, findExactTrainingOutputMatch, findNormalizedTrainingOutputMatch, getTrainingPairs, normalizeInsignificant, type TrainingPair } from "@/lib/training-lookup";
import { DATABASE_MATCH_THRESHOLD, TOPIC_MATCH_THRESHOLD } from "@/lib/training-schema";

/**
 * Keyword search over stored ai_text. Humanize reads the user's draft for a
 * main topic and returns that row's paired human_text. It does not require a
 * word-for-word copy of a stored draft.
 */

export { DATABASE_MATCH_THRESHOLD, TOPIC_MATCH_THRESHOLD };

export const RETRIEVAL_METHOD =
  "cached inverted TF-IDF with dataset co-occurrence expansion, character n-grams, and structure affinity";

export const SIMILARITY_METHOD =
  "cosine over expanded TF-IDF + hashed character 4-grams, with Jaccard, writing-type, and length affinity";

export type SimilarityBand = "high" | "medium" | "low";

export type RetrievedTrainingExample = {
  index: number;
  score: number;
  input: string;
  output: string;
};

export type TrainingRetrieval = {
  method: typeof RETRIEVAL_METHOD;
  similarity: typeof SIMILARITY_METHOD;
  band: SimilarityBand;
  examples: RetrievedTrainingExample[];
};

const HIGH_SIMILARITY = 0.28;
const MEDIUM_SIMILARITY = 0.14;
const CHAR_DIMS = 128;
const CHAR_N = 4;
const NEIGHBORS_PER_TERM = 8;
const MAX_EXAMPLES = 3;
const MAX_COOCCUR_TERMS = 36;
const MIN_UNIGRAM_DF = 2;
const MIN_BIGRAM_DF = 4;

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
  "its",
  "there",
  "here",
  "such",
  "only",
  "more",
  "most",
  "some",
  "any",
  "each",
  "other",
  "than",
  "own",
]);

const SHORT_TOPIC_TERMS = new Set(["ai", "ml", "vr", "ar", "gpu", "iot"]);

const TOPIC_SYNONYMS: Record<string, string[]> = {
  ai: ["artificial", "intelligence"],
  artificial: ["ai"],
  intelligence: ["ai"],
  tech: ["technology", "technological"],
  technology: ["technological", "tech"],
  technological: ["technology", "tech"],
  computer: ["computing", "computers"],
  computers: ["computer", "computing"],
  computing: ["computer", "computers"],
  smartphone: ["smartphones", "mobile", "phones"],
  smartphones: ["smartphone", "mobile"],
};

const TECHNOLOGY_TERMS = new Set([
  "ai",
  "algorithm",
  "algorithms",
  "artificial",
  "automation",
  "computer",
  "computers",
  "computing",
  "cyber",
  "device",
  "devices",
  "digital",
  "electronics",
  "gpu",
  "intelligence",
  "internet",
  "machine",
  "nvidia",
  "online",
  "robot",
  "robotics",
  "semiconductor",
  "smartphone",
  "smartphones",
  "software",
  "tech",
  "technology",
  "technological",
]);

type WritingType = "email" | "list" | "qa" | "essay";

type SparseTerm = { term: string; weight: number };

type TopicCategory = "technology" | "general";

type IndexedDoc = {
  pair: TrainingPair;
  terms: SparseTerm[];
  unigrams: Set<string>;
  norm: number;
  charVec: Float32Array;
  charNorm: number;
  type: WritingType;
  wordCount: number;
  paragraphCount: number;
  category: TopicCategory;
  titleUnigrams: Set<string>;
};

type RetrievalIndex = {
  docs: IndexedDoc[];
  idf: Map<string, number>;
  neighbors: Map<string, SparseTerm[]>;
  inverted: Map<string, Array<{ doc: number; weight: number }>>;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function tokenizeTopic(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((token) => {
      if (!token || STOPWORDS.has(token)) return false;
      if (SHORT_TOPIC_TERMS.has(token)) return true;
      return token.length >= 3;
    });
}

function topicCategory(tokens: Iterable<string>): TopicCategory {
  const hits = new Set<string>();
  for (const token of tokens) {
    if (TECHNOLOGY_TERMS.has(token)) hits.add(token);
  }
  return hits.size >= 2 ? "technology" : "general";
}

/** Essay glue that should not become the main topic keyword. */
const TOPIC_GLUE = new Set([
  "also",
  "another",
  "become",
  "becomes",
  "being",
  "best",
  "better",
  "conclusion",
  "could",
  "different",
  "does",
  "during",
  "each",
  "even",
  "every",
  "good",
  "help",
  "helping",
  "helps",
  "however",
  "important",
  "including",
  "individual",
  "individuals",
  "into",
  "just",
  "large",
  "late",
  "life",
  "like",
  "make",
  "makes",
  "many",
  "means",
  "modern",
  "more",
  "most",
  "much",
  "need",
  "needs",
  "often",
  "others",
  "part",
  "people",
  "person",
  "play",
  "plays",
  "really",
  "role",
  "several",
  "should",
  "significant",
  "society",
  "still",
  "such",
  "therefore",
  "thing",
  "things",
  "today",
  "used",
  "using",
  "usually",
  "various",
  "well",
  "world",
  "would",
]);

const MONTH_TERMS = new Set([
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

function isTopicKeyword(term: string): boolean {
  if (!term || STOPWORDS.has(term) || TOPIC_GLUE.has(term) || MONTH_TERMS.has(term)) return false;
  if (SHORT_TOPIC_TERMS.has(term)) return true;
  return term.length >= 4;
}

function topicVariants(term: string): string[] {
  const variants = new Set<string>([term, ...(TOPIC_SYNONYMS[term] ?? [])]);
  if (term.endsWith("ies") && term.length > 5) {
    variants.add(`${term.slice(0, -3)}y`);
  } else if (term.endsWith("ss") || term.endsWith("us") || term.endsWith("is")) {
    variants.add(`${term}es`);
  } else if (term.endsWith("s") && term.length > 4) {
    variants.add(term.slice(0, -1));
  } else {
    variants.add(`${term}s`);
  }
  return [...variants];
}

function termPresent(term: string, docTerms: Set<string>): boolean {
  if (docTerms.has(term)) return true;
  return (TOPIC_SYNONYMS[term] ?? []).some((synonym) => docTerms.has(synonym));
}

function termInSet(term: string, docTerms: Set<string>): boolean {
  return topicVariants(term).some((variant) => termPresent(variant, docTerms));
}

function extractHeadingLine(text: string): string | null {
  const lines = text
    .trim()
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines[0];
  if (!first) return null;
  const heading = first
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
  const words = heading.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 8 && !/[.?!]$/.test(heading)) {
    return heading;
  }
  return null;
}

function extractHashtagTopics(text: string): string[] {
  const head = text.trim().split(/\n/).slice(0, 6).join("\n");
  const tags = [...head.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]!.toLowerCase());
  return [...new Set(tags.filter(isTopicKeyword))];
}

function firstSentences(text: string, count = 2): string {
  const body = text.trim().replace(/^#{1,6}\s*[^\n]+\n+/, "");
  const parts = body.split(/(?<=[.!?])\s+/).filter((part) => part.trim());
  return parts.slice(0, count).join(" ");
}

type TopicKeyword = { term: string; weight: number };

function extractTopicKeywords(text: string): TopicKeyword[] {
  const hashtags = extractHashtagTopics(text);
  const heading = extractHeadingLine(text);
  const first = firstSentences(text, 1);
  const headingTokens = heading ? tokenizeTopic(heading).filter(isTopicKeyword) : [];
  const firstTokens = tokenizeTopic(first).filter(isTopicKeyword);
  const openingTokens = tokenizeTopic(`${hashtags.join(" ")} ${heading ?? ""} ${firstSentences(text, 2)}`).filter(
    isTopicKeyword,
  );
  const fullCounts = termCounts(tokenizeTopic(text).filter(isTopicKeyword));
  const openingSet = new Set(openingTokens);
  const substantialFirst = firstTokens.filter(
    (term) => term.length >= 6 || SHORT_TOPIC_TERMS.has(term),
  );
  const firstPool = substantialFirst.length > 0 ? substantialFirst : firstTokens;
  const repeatedFirst = [...firstPool].sort((left, right) => {
    const byTf = (fullCounts.get(right) ?? 0) - (fullCounts.get(left) ?? 0);
    if (byTf !== 0) return byTf;
    return firstPool.indexOf(left) - firstPool.indexOf(right);
  });
  const primaryTerms =
    hashtags.length > 0 ? hashtags : headingTokens.length > 0 ? headingTokens : repeatedFirst.slice(0, 1);
  const primarySet = new Set(primaryTerms);
  const candidates = new Set([...primaryTerms, ...openingTokens]);

  return [...candidates]
    .map((term) => {
      const tf = Math.min(fullCounts.get(term) ?? 1, 8);
      const weight = (primarySet.has(term) ? 20 : 0) + (openingSet.has(term) ? 3 : 0) + tf;
      return { term, weight };
    })
    .sort((left, right) => right.weight - left.weight || left.term.localeCompare(right.term))
    .slice(0, 8);
}

function withBigrams(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens;
  const grams = tokens.slice();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    grams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return grams;
}

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function charGramVector(text: string): Float32Array {
  const vec = new Float32Array(CHAR_DIMS);
  const compact = text.toLowerCase().replace(/\s+/g, " ").slice(0, 4_000);
  if (compact.length < CHAR_N) return vec;
  for (let i = 0; i <= compact.length - CHAR_N; i += 1) {
    vec[hash32(compact.slice(i, i + CHAR_N)) % CHAR_DIMS] += 1;
  }
  return vec;
}

function l2(values: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum);
}

function dotGrams(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < CHAR_DIMS; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function writingType(text: string): WritingType {
  const trimmed = text.trim();
  const first = trimmed.slice(0, 80).toLowerCase();
  if (/^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/.test(first)) {
    return "email";
  }
  if (/(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S/.test(trimmed)) return "list";
  const questions = (trimmed.match(/\?/g) ?? []).length;
  if (questions >= 3) return "qa";
  return "essay";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sparseFromCounts(counts: Map<string, number>, idf: Map<string, number>): SparseTerm[] {
  const terms: SparseTerm[] = [];
  for (const [term, tf] of counts) {
    const weight = (1 + Math.log(tf)) * (idf.get(term) ?? 0);
    if (weight > 0) terms.push({ term, weight });
  }
  return terms;
}

function sparseNorm(terms: SparseTerm[]): number {
  return Math.sqrt(terms.reduce((sum, item) => sum + item.weight * item.weight, 0));
}

function idfWeight(docCount: number, df: number): number {
  return Math.log((docCount + 1) / (df + 1)) + 1;
}

function buildIndex(): RetrievalIndex {
  const pairs = getTrainingPairs();
  const unigrams = pairs.map((pair) => tokenize(pair.input));
  const docCount = pairs.length || 1;
  const uniDf = new Map<string, number>();
  const bigramDf = new Map<string, number>();
  const bigramsByDoc: string[][] = unigrams.map((tokens) => {
    const seen = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i += 1) {
      seen.add(`${tokens[i]}_${tokens[i + 1]}`);
    }
    return [...seen];
  });

  for (const tokens of unigrams) {
    for (const term of new Set(tokens)) {
      uniDf.set(term, (uniDf.get(term) ?? 0) + 1);
    }
  }
  for (const grams of bigramsByDoc) {
    for (const term of grams) {
      bigramDf.set(term, (bigramDf.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of uniDf) {
    if (count < MIN_UNIGRAM_DF || count > docCount * 0.65) continue;
    idf.set(term, idfWeight(docCount, count));
  }
  for (const [term, count] of bigramDf) {
    if (count < MIN_BIGRAM_DF || count > docCount * 0.5) continue;
    idf.set(term, idfWeight(docCount, count));
  }

  const cooccur = new Map<string, Map<string, number>>();
  const termDf = new Map<string, number>();
  for (const tokens of unigrams) {
    const counts = termCounts(tokens);
    const unique = [...counts.entries()]
      .filter(([term]) => idf.has(term))
      .sort((left, right) => right[1] - left[1])
      .slice(0, MAX_COOCCUR_TERMS)
      .map(([term]) => term);
    for (const term of unique) {
      termDf.set(term, (termDf.get(term) ?? 0) + 1);
    }
    for (let i = 0; i < unique.length; i += 1) {
      const left = unique[i]!;
      let row = cooccur.get(left);
      if (!row) {
        row = new Map();
        cooccur.set(left, row);
      }
      for (let j = 0; j < unique.length; j += 1) {
        if (i === j) continue;
        const right = unique[j]!;
        row.set(right, (row.get(right) ?? 0) + 1);
      }
    }
  }

  const neighbors = new Map<string, SparseTerm[]>();
  for (const [term, related] of cooccur) {
    const scored: SparseTerm[] = [];
    const pTerm = (termDf.get(term) ?? 1) / docCount;
    for (const [other, joint] of related) {
      if (joint < 2) continue;
      const pOther = (termDf.get(other) ?? 1) / docCount;
      const pBoth = joint / docCount;
      const pmi = Math.log((pBoth + 1e-9) / (pTerm * pOther + 1e-9));
      if (pmi <= 0) continue;
      scored.push({ term: other, weight: pmi });
    }
    scored.sort((a, b) => b.weight - a.weight);
    const top = scored.slice(0, NEIGHBORS_PER_TERM);
    const max = top[0]?.weight ?? 0;
    neighbors.set(
      term,
      top.map((item) => ({
        term: item.term,
        weight: max > 0 ? item.weight / max : 0,
      })),
    );
  }

  const inverted = new Map<string, Array<{ doc: number; weight: number }>>();
  const docs: IndexedDoc[] = pairs.map((pair, docIndex) => {
    const mixed = [...(unigrams[docIndex] ?? []), ...(bigramsByDoc[docIndex] ?? [])];
    const terms = sparseFromCounts(termCounts(mixed), idf);
    const charVec = charGramVector(pair.input);
    for (const item of terms) {
      const posting = inverted.get(item.term);
      if (posting) posting.push({ doc: docIndex, weight: item.weight });
      else inverted.set(item.term, [{ doc: docIndex, weight: item.weight }]);
    }
    return {
      pair,
      terms,
      unigrams: new Set(unigrams[docIndex] ?? []),
      norm: sparseNorm(terms) || 1,
      charVec,
      charNorm: l2(charVec) || 1,
      type: writingType(pair.input),
      wordCount: wordCount(pair.input),
      paragraphCount: paragraphCount(pair.input),
      category: topicCategory(unigrams[docIndex] ?? []),
      titleUnigrams: new Set(tokenizeTopic(pair.input.slice(0, 420))),
    };
  });

  console.info("[humanize] built training retrieval index", {
    docs: docs.length,
    terms: idf.size,
    neighbors: neighbors.size,
  });

  return { docs, idf, neighbors, inverted };
}

let cachedIndex: RetrievalIndex | null = null;

function getRetrievalIndex(): RetrievalIndex {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

function expandQuery(counts: Map<string, number>, neighbors: Map<string, SparseTerm[]>): Map<string, number> {
  const expanded = new Map(counts);
  for (const [term, tf] of counts) {
    if (term.includes("_")) continue;
    const related = neighbors.get(term);
    if (!related) continue;
    for (const neighbor of related) {
      expanded.set(neighbor.term, (expanded.get(neighbor.term) ?? 0) + tf * neighbor.weight * 0.42);
    }
  }
  return expanded;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const term of a) {
    if (b.has(term)) overlap += 1;
  }
  return overlap / (a.size + b.size - overlap);
}

function lengthAffinity(queryWords: number, docWords: number): number {
  if (queryWords <= 0 || docWords <= 0) return 0;
  const ratio = Math.max(queryWords, docWords) / Math.min(queryWords, docWords);
  return Math.max(0, 1 - Math.log(ratio) / Math.log(6));
}

function bandFor(score: number): SimilarityBand {
  if (score >= HIGH_SIMILARITY) return "high";
  if (score >= MEDIUM_SIMILARITY) return "medium";
  return "low";
}

function selectExamples(
  ranked: Array<{ doc: IndexedDoc; score: number }>,
): { band: SimilarityBand; examples: RetrievedTrainingExample[] } {
  const top = ranked.slice(0, MAX_EXAMPLES);
  const best = top[0]?.score ?? 0;
  const band = bandFor(best);

  let chosen = top;
  if (band === "high") {
    const floor = Math.max(HIGH_SIMILARITY * 0.9, best * 0.8);
    const strong = ranked.filter((item) => item.score >= floor).slice(0, MAX_EXAMPLES);
    chosen = strong.length > 0 ? strong : top.slice(0, 1);
  }

  return {
    band,
    examples: chosen.map((item) => ({
      index: item.doc.pair.index,
      score: item.score,
      input: item.doc.pair.input,
      output: item.doc.pair.output,
    })),
  };
}

/**
 * Rank training inputs by semantic similarity. Never mutates stored outputs.
 * Only the top 1–3 pairs are returned; the rest of the dataset stays on the server.
 */
export function retrieveTrainingExamples(userText: string, k = MAX_EXAMPLES): TrainingRetrieval {
  const index = getRetrievalIndex();
  const queryTokens = tokenize(userText);
  const queryUnigrams = new Set(queryTokens);
  const rawCounts = termCounts(withBigrams(queryTokens));
  const expandedCounts = expandQuery(rawCounts, index.neighbors);
  const queryTerms = sparseFromCounts(expandedCounts, index.idf);
  const queryNorm = sparseNorm(queryTerms) || 1;
  const queryGrams = charGramVector(userText);
  const queryGramNorm = l2(queryGrams) || 1;
  const queryType = writingType(userText);
  const queryWords = wordCount(userText);

  const tfidfScores = new Float64Array(index.docs.length);
  for (const item of queryTerms) {
    const posting = index.inverted.get(item.term);
    if (!posting) continue;
    for (const hit of posting) {
      tfidfScores[hit.doc] += item.weight * hit.weight;
    }
  }

  const queryParas = Math.max(1, paragraphCount(userText));
  const ranked: Array<{ doc: IndexedDoc; score: number }> = index.docs.map((doc, docIndex) => {
    const tfidf = (tfidfScores[docIndex] ?? 0) / (queryNorm * doc.norm);
    const grams = dotGrams(queryGrams, doc.charVec) / (queryGramNorm * doc.charNorm);
    const overlap = jaccard(queryUnigrams, doc.unigrams);
    const typeScore = queryType === doc.type ? 1 : 0.35;
    const lengthScore = lengthAffinity(queryWords, doc.wordCount);
    const paraScore = lengthAffinity(queryParas, Math.max(1, doc.paragraphCount));
    const lexical = 0.74 * tfidf + 0.26 * overlap;
    const style = 0.5 * grams + 0.28 * typeScore + 0.12 * lengthScore + 0.1 * paraScore;
    const styleGate = Math.min(1, lexical / 0.1);
    const score = Math.max(0, Math.min(1, 0.88 * lexical + 0.12 * style * styleGate));
    return { doc, score: Number(score.toFixed(4)) };
  });

  ranked.sort((a, b) => b.score - a.score || a.doc.pair.index - b.doc.pair.index);
  const selected = selectExamples(ranked.slice(0, Math.max(k, MAX_EXAMPLES)));

  return {
    method: RETRIEVAL_METHOD,
    similarity: SIMILARITY_METHOD,
    band: selected.band,
    examples: selected.examples.slice(0, k),
  };
}

function contentOverlap(a: string, b: string): number {
  const left = new Set(
    a
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3),
  );
  if (left.size === 0) return 0;
  const right = new Set(
    b
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3),
  );
  let hits = 0;
  for (const word of left) {
    if (right.has(word)) hits += 1;
  }
  return hits / left.size;
}

/**
 * Stored human_text used only as cadence examples for unseen drafts.
 * Prefers rows whose wording does not overlap the user's topic, so the
 * model cannot substitute a training essay for the user's draft.
 */
export function pickDistantStyleReferences(
  userText: string,
  k = MAX_EXAMPLES,
): Array<{ index: number; input: string; output: string }> {
  const ranked = getTrainingPairs()
    .map((pair) => ({
      index: pair.index,
      input: pair.input,
      output: pair.output,
      overlap: contentOverlap(userText, pair.output),
    }))
    .sort((a, b) => a.overlap - b.overlap || a.index - b.index);

  const chosen: Array<{ index: number; input: string; output: string }> = [];
  const usedOpenings = new Set<string>();
  for (const row of ranked) {
    if (row.output.trim().length < 80) continue;
    const opening = row.output.slice(0, 48).toLowerCase();
    if (usedOpenings.has(opening)) continue;
    usedOpenings.add(opening);
    chosen.push({ index: row.index, input: row.input, output: row.output });
    if (chosen.length >= k) break;
  }
  return chosen;
}

export function getRetrievalIndexStats(): {
  docs: number;
  terms: number;
  neighbors: number;
} {
  const index = getRetrievalIndex();
  return {
    docs: index.docs.length,
    terms: index.idf.size,
    neighbors: index.neighbors.size,
  };
}

export type DatabaseTrainingMatch = {
  index: number;
  score: number;
  input: string;
  output: string;
  kind: "exact" | "near_exact" | "similarity" | "topic";
};

function lockedPair(
  pair: TrainingPair,
  score: number,
  kind: DatabaseTrainingMatch["kind"],
): DatabaseTrainingMatch {
  if (pair.index < 0 || !pair.input || !pair.output) {
    throw new Error("Training pair is missing a connected input/output row.");
  }
  return {
    index: pair.index,
    score,
    input: pair.input,
    output: pair.output,
    kind,
  };
}

function lengthRatioOk(queryWords: number, docWords: number): boolean {
  if (queryWords <= 0 || docWords <= 0) return false;
  const ratio = queryWords / docWords;
  return ratio >= 0.68 && ratio <= 1.4;
}

function isSameUnderlyingDraft(query: string, doc: string, overlap: number): boolean {
  if (overlap < 0.75) return false;
  const qWords = wordCount(query);
  const copy = qWords >= 40 ? phraseCopyRatio(query, doc, 5) : 1;
  if (qWords >= 80 && copy < 0.42) return false;

  const queryParas = paragraphCount(query);
  const docParas = paragraphCount(doc);
  if (Math.max(queryParas, docParas) >= 3 && copy < 0.55) {
    const ratio = queryParas / docParas;
    if (ratio < 0.55 || ratio > 1.8) return false;
  }
  return true;
}

/**
 * ai_text is the lookup sample. If the user pasted that draft, or a truncated /
 * lightly edited copy of it, return the paired human_text from the same row.
 */
function findAiTextSampleMatch(userText: string): DatabaseTrainingMatch | null {
  const queryWords = wordCount(userText);
  if (queryWords < 50) return null;

  const queryNorm = normalizeInsignificant(userText);
  if (queryNorm.length < 80) return null;

  let best: { pair: TrainingPair; score: number } | null = null;

  for (const pair of getTrainingPairs()) {
    const docWords = wordCount(pair.input);
    const ratio = queryWords / docWords;
    if (ratio < 0.58 || ratio > 1.55) continue;

    const docNorm = normalizeInsignificant(pair.input);
    const prefixLen = Math.min(queryNorm.length, docNorm.length, 900);
    const prefixHit =
      prefixLen >= 80 &&
      (docNorm.startsWith(queryNorm.slice(0, prefixLen)) ||
        queryNorm.startsWith(docNorm.slice(0, prefixLen)) ||
        docNorm.includes(queryNorm) ||
        queryNorm.includes(docNorm));
    const copy = phraseCopyRatio(userText, pair.input, 5);
    if (!prefixHit && copy < 0.58) continue;
    if (prefixHit && copy < 0.22 && ratio < 0.72) continue;

    const score = Math.max(copy, prefixHit ? 0.93 : 0);
    if (!best || score > best.score) {
      best = { pair, score };
    }
  }

  if (!best) return null;
  return lockedPair(best.pair, Number(best.score.toFixed(4)), "near_exact");
}

/**
 * Vector + lexical search against stored ai_text.
 *
 * Exact string, insignificant spacing/punctuation/capitalization, truncated
 * ai_text samples, or TF-IDF cosine + Jaccard + char 4-grams >= 0.85 with a
 * same-draft gate. A related topic without the same sentences is not a hit.
 */
export function findDatabaseMatch(userText: string): DatabaseTrainingMatch | null {
  const exact = findExactTrainingMatch(userText);
  if (exact) return lockedPair(exact, 1, "exact");

  const exactOutput = findExactTrainingOutputMatch(userText);
  if (exactOutput) return lockedPair(exactOutput, 1, "exact");

  const nearExact = findNormalizedTrainingMatch(userText);
  if (nearExact) return lockedPair(nearExact, 0.999, "near_exact");

  const nearOutput = findNormalizedTrainingOutputMatch(userText);
  if (nearOutput) return lockedPair(nearOutput, 0.999, "near_exact");

  const sample = findAiTextSampleMatch(userText);
  if (sample) return sample;

  const index = getRetrievalIndex();
  const queryTokens = tokenize(userText);
  if (queryTokens.length === 0) return null;

  const queryUnigrams = new Set(queryTokens);
  const queryTerms = sparseFromCounts(termCounts(withBigrams(queryTokens)), index.idf);
  const queryNorm = sparseNorm(queryTerms) || 1;
  const queryGrams = charGramVector(userText);
  const queryGramNorm = l2(queryGrams) || 1;
  const queryWords = wordCount(userText);

  const tfidfScores = new Float64Array(index.docs.length);
  for (const item of queryTerms) {
    const posting = index.inverted.get(item.term);
    if (!posting) continue;
    for (const hit of posting) {
      tfidfScores[hit.doc] += item.weight * hit.weight;
    }
  }

  let best: { doc: IndexedDoc; score: number; overlap: number } | null = null;
  for (let docIndex = 0; docIndex < index.docs.length; docIndex += 1) {
    const doc = index.docs[docIndex]!;
    if (!lengthRatioOk(queryWords, doc.wordCount)) continue;
    const tfidf = (tfidfScores[docIndex] ?? 0) / (queryNorm * doc.norm);
    const overlap = jaccard(queryUnigrams, doc.unigrams);
    const grams = dotGrams(queryGrams, doc.charVec) / (queryGramNorm * doc.charNorm);
    const score = Math.max(0, Math.min(1, 0.55 * tfidf + 0.3 * overlap + 0.15 * grams));
    if (!best || score > best.score) {
      best = { doc, score, overlap };
    }
  }

  if (
    !best ||
    best.score < DATABASE_MATCH_THRESHOLD ||
    !isSameUnderlyingDraft(userText, best.doc.pair.input, best.overlap)
  ) {
    return null;
  }

  return lockedPair(best.doc.pair, Number(best.score.toFixed(4)), "similarity");
}

export function peekClosestTrainingScore(userText: string): { index: number; score: number } | null {
  const hit = findTopicMatch(userText) ?? findDatabaseMatch(userText);
  if (hit) return { index: hit.index, score: hit.score };
  const retrieval = retrieveTrainingExamples(userText, 1);
  const top = retrieval.examples[0];
  if (!top) return null;
  return { index: top.index, score: top.score };
}

export function isTopicQuery(text: string): boolean {
  const words = wordCount(text);
  if (words <= 24) return true;
  if (words > 40) return false;
  return paragraphCount(text) <= 1;
}

/**
 * Keyword / main-topic search over stored ai_text.
 * Reads the user's draft for a title, #hashtag, or opening keyword, then
 * returns that row's paired human_text unchanged. Different AI drafts on
 * the same topic do not need to match the stored ai_text word for word.
 */
export function findTopicMatch(userText: string): DatabaseTrainingMatch | null {
  const keywords = extractTopicKeywords(userText);
  const primary = keywords[0];
  if (!primary) return null;

  const index = getRetrievalIndex();
  let best: { doc: IndexedDoc; score: number } | null = null;

  for (const doc of index.docs) {
    const opening = new Set(tokenizeTopic(doc.pair.input.slice(0, 480)));
    const titleAndOpening = new Set([...doc.titleUnigrams, ...opening]);
    if (!termInSet(primary.term, titleAndOpening)) continue;

    let matched = 0;
    let total = 0;
    for (const keyword of keywords) {
      total += keyword.weight;
      if (termInSet(keyword.term, titleAndOpening)) matched += keyword.weight;
      else if (termInSet(keyword.term, doc.unigrams)) matched += keyword.weight * 0.4;
    }
    const coverage = total > 0 ? matched / total : 0;
    // Primary keyword in the stored opening is the topic hit; coverage only ranks pairs.
    const score = Number((0.72 + 0.28 * coverage).toFixed(4));
    if (!best || score > best.score || (score === best.score && doc.pair.index < best.doc.pair.index)) {
      best = { doc, score };
    }
  }

  if (!best || best.score < TOPIC_MATCH_THRESHOLD) return null;

  const match = lockedPair(best.doc.pair, best.score, "topic");
  if (match.index !== best.doc.pair.index || match.output !== best.doc.pair.output) {
    return null;
  }
  return match;
}
