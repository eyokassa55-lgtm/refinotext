import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { DatabaseTrainingMatch } from "@/lib/training-retrieval";

export const WIKIPEDIA_DATASET_FILENAME = "wikipedia_750.jsonl";
export const WIKIPEDIA_EDITOR_MAX_CHARS = 2400;
export const WIKIPEDIA_INDEX_OFFSET = 10_000;

export type WikipediaListItem = {
  id: number;
  topic: string;
  category: string;
};

export type WikipediaArticle = WikipediaListItem & {
  source_url: string;
  source_text: string;
};

type WikipediaRow = WikipediaArticle & {
  input: string;
  output: string;
};

const STOPWORDS = new Set([
  "the",
  "of",
  "and",
  "in",
  "a",
  "an",
  "to",
  "for",
  "on",
  "by",
  "at",
]);

const ROMAN = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]);

function candidatePaths(): string[] {
  const filename = WIKIPEDIA_DATASET_FILENAME;
  return [
    path.join(process.cwd(), "data", filename),
    path.join(process.cwd(), filename),
    path.resolve(__dirname, "../../data", filename),
    path.resolve(__dirname, "../../../data", filename),
  ];
}

export function resolveWikipediaDatasetPath(): string {
  for (const candidate of candidatePaths()) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("The Wikipedia dataset is not available on the server.");
}

function stripNavSections(text: string): string {
  const markers = [
    /\nSee also\n/i,
    /\nReferences\n/i,
    /\nExternal links\n/i,
    /\nFurther reading\n/i,
    /\nNotes\n/i,
  ];
  let out = text.trim();
  for (const marker of markers) {
    const index = out.search(marker);
    if (index >= 400) out = out.slice(0, index).trim();
  }
  return out;
}

function excerpt(text: string, maxChars = WIKIPEDIA_EDITOR_MAX_CHARS): string {
  const cleaned = stripNavSections(text);
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const paragraph = slice.lastIndexOf("\n\n");
  const sentence = slice.lastIndexOf(". ");
  const cut = Math.max(paragraph, sentence);
  if (cut >= 500) {
    return slice.slice(0, sentence === cut ? cut + 1 : cut).trim();
  }
  return slice.trim();
}

function parseRow(value: unknown, id: number): WikipediaRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const topic = row.topic;
  const sourceText = row.source_text;
  const sourceUrl = row.source_url;
  const category = row.category;
  if (
    typeof topic !== "string" ||
    typeof sourceText !== "string" ||
    typeof sourceUrl !== "string" ||
    typeof category !== "string"
  ) {
    return null;
  }
  const output = excerpt(sourceText);
  if (output.length < 400) return null;
  return {
    id,
    topic: topic.trim(),
    category: category.trim(),
    source_url: sourceUrl.trim(),
    source_text: output,
    input: `${topic.trim()}\n\n${output}`,
    output,
  };
}

type WikipediaIndex = {
  rows: WikipediaRow[];
  byId: Map<number, WikipediaRow>;
  byNormalizedOutput: Map<string, WikipediaRow>;
};

function normalizeKey(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeInsignificant(text: string): string {
  return normalizeKey(text)
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadIndex(): WikipediaIndex {
  const datasetPath = resolveWikipediaDatasetPath();
  const text = readFileSync(datasetPath, "utf8");
  const rows: WikipediaRow[] = [];
  const byId = new Map<number, WikipediaRow>();
  const byNormalizedOutput = new Map<string, WikipediaRow>();
  let id = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const row = parseRow(parsed, id);
    if (!row) continue;
    rows.push(row);
    byId.set(id, row);
    const normalized = normalizeInsignificant(row.output);
    if (normalized && !byNormalizedOutput.has(normalized)) {
      byNormalizedOutput.set(normalized, row);
    }
    id += 1;
  }

  console.info("[humanize] loaded Wikipedia corpus", {
    path: WIKIPEDIA_DATASET_FILENAME,
    rows: rows.length,
  });

  return { rows, byId, byNormalizedOutput };
}

let cached: WikipediaIndex | null = null;

function getIndex(): WikipediaIndex {
  if (!cached) cached = loadIndex();
  return cached;
}

export function listWikipediaArticles(): WikipediaListItem[] {
  return getIndex().rows.map(({ id, topic, category }) => ({ id, topic, category }));
}

export function getWikipediaArticle(id: number): WikipediaArticle | null {
  const row = getIndex().byId.get(id);
  if (!row) return null;
  return {
    id: row.id,
    topic: row.topic,
    category: row.category,
    source_url: row.source_url,
    source_text: row.source_text,
  };
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => {
      if (!token || STOPWORDS.has(token)) return false;
      return token.length > 2 || /^\d+$/.test(token) || ROMAN.has(token);
    });
}

function openingText(text: string): string {
  return text.trim().split(/\n+/).slice(0, 4).join(" ").slice(0, 480);
}

function toMatch(row: WikipediaRow, score: number, kind: DatabaseTrainingMatch["kind"]): DatabaseTrainingMatch {
  return {
    index: WIKIPEDIA_INDEX_OFFSET + row.id,
    score,
    input: row.input,
    output: row.output,
    kind,
  };
}

/**
 * Match a draft to a Wikipedia article by exact excerpt or by article title.
 * Training-pair topic hits should be checked first so the 722 gold essays win.
 */
export function findWikipediaMatch(userText: string): DatabaseTrainingMatch | null {
  if (typeof userText !== "string" || userText.trim().length === 0) return null;
  const index = getIndex();
  const trimmed = normalizeKey(userText);

  for (const row of index.rows) {
    if (trimmed === row.output || trimmed === row.input) {
      return toMatch(row, 1, "exact");
    }
  }

  const normalized = normalizeInsignificant(userText);
  if (normalized) {
    const hit = index.byNormalizedOutput.get(normalized);
    if (hit) return toMatch(hit, 0.999, "near_exact");
  }

  const opening = openingText(userText).toLowerCase();
  const openingTokens = new Set(titleTokens(opening));
  if (openingTokens.size === 0) return null;

  let best: { row: WikipediaRow; score: number } | null = null;
  for (const row of index.rows) {
    const required = titleTokens(row.topic);
    if (required.length === 0) continue;
    const covered = required.every((token) => openingTokens.has(token));
    if (!covered) continue;
    if (required.length === 1) {
      const primary = [...openingTokens][0];
      if (primary !== required[0] && !opening.startsWith(required[0])) continue;
    }
    const score = 0.9 + Math.min(required.length, 5) * 0.01;
    if (!best || required.length > titleTokens(best.row.topic).length || score > best.score) {
      best = { row, score };
    }
  }

  return best ? toMatch(best.row, Number(best.score.toFixed(4)), "topic") : null;
}
