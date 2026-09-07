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
  aliases: string[];
};

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
  const aliases = Array.isArray(row.aliases)
    ? row.aliases.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return {
    id,
    topic: topic.trim(),
    category: category.trim(),
    source_url: sourceUrl.trim(),
    source_text: output,
    input: `${topic.trim()}\n\n${output}`,
    output,
    aliases: aliases.map((value) => value.trim()),
  };
}

type WikipediaIndex = {
  rows: WikipediaRow[];
  byId: Map<number, WikipediaRow>;
  byNormalizedOutput: Map<string, WikipediaRow>;
  byTopicKey: Map<string, WikipediaRow>;
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
]);

const SHORT_TOPIC_TERMS = new Set(["ai", "ml", "vr", "ar", "gpu", "iot"]);

const LEADING_TOPIC_FRAMES = new Set([
  "about",
  "abstract",
  "benefits",
  "chapter",
  "concept",
  "conceptual",
  "concerning",
  "considering",
  "critical",
  "development",
  "discussing",
  "dossier",
  "effect",
  "effects",
  "essence",
  "evolution",
  "examining",
  "exploring",
  "field",
  "future",
  "impact",
  "importance",
  "influence",
  "introduction",
  "literature",
  "notes",
  "overview",
  "phenomenon",
  "protecting",
  "regarding",
  "relationship",
  "report",
  "review",
  "rise",
  "role",
  "studying",
  "understanding",
]);

const TOPIC_PHRASE_BREAK =
  /\b(?:is|are|was|were|has|have|had|do|does|did|can|will|may|might|must|should|would|could|means|refers|plays|remains|becomes|became|makes|make|made)\b/i;

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

function skipLeadingFrames(tokens: string[]): string[] {
  let index = 0;
  while (index < tokens.length && LEADING_TOPIC_FRAMES.has(tokens[index]!)) index += 1;
  return tokens.slice(index);
}

function topicKey(tokens: string[]): string {
  const unique = [...new Set(skipLeadingFrames(tokens))];
  if (unique.length === 0) return "";
  return unique.sort().join("\u0001");
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
  if (words.length >= 1 && words.length <= 20 && !/[.?!]$/.test(heading)) {
    return heading;
  }
  return null;
}

function userTopicKeys(text: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const key = topicKey(tokenizeTopic(raw));
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  const heading = extractHeadingLine(text);
  if (heading) {
    add(heading);
    const firstClause = heading.split(/[:–—]/)[0]?.trim();
    if (firstClause) add(firstClause);
  }

  const head = text.trim().split(/\n/).slice(0, 6).join("\n");
  for (const match of head.matchAll(/#([\p{L}\p{N}_-]+)/gu)) {
    add(match[1]!.replace(/_/g, " "));
  }

  // Titled drafts keep the heading as the topic. Body nouns must not
  // pull in a related article (Environment is not Water pollution).
  if (!heading) {
    const body = text.trim();
    const first = body.split(/(?<=[.!?])\s+/).filter((part) => part.trim())[0] ?? body;
    const parts = first.split(TOPIC_PHRASE_BREAK);
    add(parts[0]?.trim() ? parts[0]! : first);
  }

  return keys;
}

function titleLabels(row: WikipediaRow): string[] {
  return [row.topic, ...row.aliases];
}

function loadIndex(): WikipediaIndex {
  const datasetPath = resolveWikipediaDatasetPath();
  const text = readFileSync(datasetPath, "utf8");
  const rows: WikipediaRow[] = [];
  const byId = new Map<number, WikipediaRow>();
  const byNormalizedOutput = new Map<string, WikipediaRow>();
  const byTopicKey = new Map<string, WikipediaRow>();
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
    for (const label of titleLabels(row)) {
      const key = topicKey(tokenizeTopic(label));
      if (key && !byTopicKey.has(key)) {
        byTopicKey.set(key, row);
      }
    }
    id += 1;
  }

  console.info("[humanize] loaded Wikipedia corpus", {
    path: WIKIPEDIA_DATASET_FILENAME,
    rows: rows.length,
  });

  return { rows, byId, byNormalizedOutput, byTopicKey };
}

let cached: WikipediaIndex | null = null;

function getIndex(): WikipediaIndex {
  if (!cached) cached = loadIndex();
  return cached;
}

export function listWikipediaArticles(): WikipediaListItem[] {
  return getIndex().rows.map(({ id, topic, category }) => ({ id, topic, category }));
}

export function getWikipediaRowCount(): number {
  return getIndex().rows.length;
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

export function getWikipediaArticleByTopic(topic: string): WikipediaArticle | null {
  const needle = topic.trim().toLowerCase();
  if (!needle) return null;
  const row = getIndex().rows.find((item) => item.topic.toLowerCase() === needle);
  if (!row) return null;
  return getWikipediaArticle(row.id);
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
 * Humanize uses Wikipedia only. A hit is the same article (pasted excerpt)
 * or the same topic title after stopwords (The Environment = Environment).
 * Body words never select a related article.
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
    const excerptHit = index.byNormalizedOutput.get(normalized);
    if (excerptHit) return toMatch(excerptHit, 0.999, "near_exact");
  }

  for (const key of userTopicKeys(userText)) {
    const topicHit = index.byTopicKey.get(key);
    if (topicHit) return toMatch(topicHit, 0.99, "topic");
  }

  return null;
}
