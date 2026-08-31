import "server-only";

import { paragraphCount, phraseCopyRatio } from "@/lib/humanize-quality";
import { findExactTrainingMatch, findNormalizedTrainingMatch, getTrainingPairs, type TrainingPair } from "@/lib/training-lookup";
import { DATABASE_MATCH_THRESHOLD } from "@/lib/training-schema";

/**
 * Indexed search over stored ai_text. Humanize uses this to return stored
 * human_text for the same underlying draft, then falls back to Vertex.
 */

export { DATABASE_MATCH_THRESHOLD };

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

type WritingType = "email" | "list" | "qa" | "essay";

type SparseTerm = { term: string; weight: number };

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
  kind: "exact" | "near_exact" | "similarity";
};

function lengthRatioOk(queryWords: number, docWords: number): boolean {
  if (queryWords <= 0 || docWords <= 0) return false;
  const ratio = queryWords / docWords;
  return ratio >= 0.82 && ratio <= 1.22;
}

function isSameUnderlyingDraft(query: string, doc: string, overlap: number): boolean {
  if (overlap < 0.75) return false;
  const qWords = wordCount(query);
  if (qWords >= 80) {
    const copy = phraseCopyRatio(query, doc, 5);
    if (copy < 0.42) return false;
  }
  const queryParas = paragraphCount(query);
  const docParas = paragraphCount(doc);
  if (Math.max(queryParas, docParas) >= 3) {
    const ratio = queryParas / docParas;
    if (ratio < 0.55 || ratio > 1.8) return false;
  }
  return true;
}

/**
 * Vector + lexical search against stored ai_text.
 *
 * Exact string, insignificant spacing/punctuation/capitalization, or
 * TF-IDF cosine + Jaccard + char 4-grams >= 0.85 with a same-draft gate.
 * A related topic without the same sentences is not a hit.
 */
export function findDatabaseMatch(userText: string): DatabaseTrainingMatch | null {
  const exact = findExactTrainingMatch(userText);
  if (exact) {
    return {
      index: exact.index,
      score: 1,
      input: exact.input,
      output: exact.output,
      kind: "exact",
    };
  }

  const nearExact = findNormalizedTrainingMatch(userText);
  if (nearExact) {
    return {
      index: nearExact.index,
      score: 0.999,
      input: nearExact.input,
      output: nearExact.output,
      kind: "near_exact",
    };
  }

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

  return {
    index: best.doc.pair.index,
    score: Number(best.score.toFixed(4)),
    input: best.doc.pair.input,
    output: best.doc.pair.output,
    kind: "similarity",
  };
}

export function peekClosestTrainingScore(userText: string): { index: number; score: number } | null {
  const hit = findDatabaseMatch(userText);
  if (hit) return { index: hit.index, score: hit.score };
  const retrieval = retrieveTrainingExamples(userText, 1);
  const top = retrieval.examples[0];
  if (!top) return null;
  return { index: top.index, score: top.score };
}
