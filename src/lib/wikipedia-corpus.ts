import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { DatabaseTrainingMatch } from "@/lib/training-retrieval";
import { formatWikipediaEditorText, hasLatexDump } from "@/lib/humanize-output";
import { countWords } from "@/lib/words";

/** On-disk name is historical. Humanize uses live English Wikipedia, not this file. */
export const WIKIPEDIA_DATASET_FILENAME = "wikipedia_750.jsonl";
/** Upper bound while fetching; final output is sized to the input word count. */
export const WIKIPEDIA_EDITOR_MAX_CHARS = 20_000;
export const WIKIPEDIA_EDITOR_MAX_PARAGRAPHS = 40;
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
  mathHeavy?: boolean;
  /** Raw plaintext extract before editor clipping — used to match input length. */
  rawExtract?: string;
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
  const output = formatWikipediaEditorText(
    topic.trim(),
    sourceText,
    WIKIPEDIA_EDITOR_MAX_CHARS,
    WIKIPEDIA_EDITOR_MAX_PARAGRAPHS,
  );
  if (output.length < 120) return null;
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

/** Hedging words in "In today's world, success is..." — not the topic. */
const TOPIC_PREAMBLE = new Set([
  "today",
  "todays",
  "nowadays",
  "currently",
  "recently",
  "rapidly",
  "increasingly",
  "often",
  "always",
  "however",
  "furthermore",
  "moreover",
  "therefore",
  "thus",
  "hence",
  "indeed",
  "clearly",
  "simply",
  "basically",
  "actually",
  "really",
  "quite",
  "still",
  "already",
  "especially",
  "particularly",
  "generally",
  "typically",
  "usually",
  "commonly",
  "competitive",
  "evolving",
  "modern",
  "world",
  "society",
  "people",
  "humanity",
  "life",
  "lives",
]);

/**
 * Extra title words that still mean the same topic
 * (Environment → Natural environment). Not "artificial" (intelligence ≠ AI).
 */
const TITLE_QUALIFIERS = new Set([
  "natural",
  "biophysical",
  "overview",
  "introduction",
  "concept",
  "human",
  "general",
  "basic",
  "electronic",
  "online",
  "international",
  "global",
]);

/**
 * Single heading words that must not alone open a Wikipedia match
 * ("things" → Internet of things, "dangerous" → Jack Dangers).
 */
const WEAK_SOLO_TOPIC_TOKENS = new Set([
  "thing",
  "things",
  "life",
  "lives",
  "world",
  "way",
  "ways",
  "people",
  "person",
  "day",
  "time",
  "part",
  "parts",
  "form",
  "type",
  "types",
  "kind",
  "kinds",
  "danger",
  "dangers",
  "dangerous",
  "stuff",
  "area",
  "areas",
  "good",
  "bad",
  "important",
  "modern",
]);

/** Related encyclopedia titles for common essay headings. */
const TOPIC_SEARCH_ALIASES: Record<string, string[]> = {
  "digital trade": ["e-commerce", "electronic commerce", "digital commerce", "trade", "online shopping"],
  "digital marketplace": ["e-commerce", "electronic commerce", "online shopping", "digital commerce"],
  ecommerce: ["e-commerce", "electronic commerce", "digital trade"],
  "e commerce": ["e-commerce", "electronic commerce", "digital trade"],
  "e-commerce": ["electronic commerce", "digital trade", "online shopping"],
  "online trade": ["e-commerce", "digital trade", "electronic commerce"],
  "international trade": ["trade", "digital trade"],
};

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

function skipPreamble(tokens: string[]): string[] {
  let index = 0;
  while (
    index < tokens.length &&
    (LEADING_TOPIC_FRAMES.has(tokens[index]!) || TOPIC_PREAMBLE.has(tokens[index]!))
  ) {
    index += 1;
  }
  return tokens.slice(index);
}

function openingClause(text: string): string {
  const body = text.trim().replace(/^#{1,6}\s*[^\n]+\n+/, "");
  const first = body.split(/(?<=[.!?])\s+/).filter((part) => part.trim())[0] ?? body;
  const parts = first.split(TOPIC_PHRASE_BREAK);
  return (parts[0]?.trim() ? parts[0]! : first).trim();
}

function headingRelatedPhrases(heading: string): string[] {
  const extras: string[] = [];
  const firstClause = heading.split(/[:–—]/)[0]?.trim();
  if (firstClause) {
    const stripped = skipPreamble(skipLeadingFrames(tokenizeTopic(firstClause)));
    if (stripped.length >= 1 && stripped.length <= 4) extras.push(stripped.join(" "));
  }
  for (const match of heading.matchAll(/\bof\s+([^:–—,]+)/gi)) {
    const tail = match[1]?.trim();
    if (tail && tokenizeTopic(tail).length <= 4) extras.push(tail);
  }
  for (const match of heading.matchAll(/\b[\p{L}]+-[\p{L}]+\b/gu)) {
    extras.push(match[0]!);
  }
  return extras;
}

function userTopicPhrases(text: string): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const key = topicKey(tokenizeTopic(cleaned));
    if (!key) return;
    const seenKey = cleaned.toLowerCase();
    if (seen.has(seenKey)) return;
    seen.add(seenKey);
    phrases.push(cleaned);
  };

  const heading = extractHeadingLine(text);
  if (heading) {
    add(heading);
    const firstClause = heading.split(/[:–—]/)[0]?.trim();
    if (firstClause) add(firstClause);
    for (const extra of headingRelatedPhrases(heading)) add(extra);
  }

  const head = text.trim().split(/\n/).slice(0, 6).join("\n");
  for (const match of head.matchAll(/#([\p{L}\p{N}_-]+)/gu)) {
    add(match[1]!.replace(/_/g, " "));
  }

  // Titled drafts keep the heading as the topic. Body nouns must not
  // pull in a related article (Environment is not Water pollution).
  if (!heading) {
    const clause = openingClause(text);
    add(clause);
    const commaParts = clause.split(",").map((part) => part.trim()).filter(Boolean);
    const afterComma = commaParts[commaParts.length - 1];
    if (afterComma && commaParts.length >= 2 && tokenizeTopic(afterComma).length <= 4) {
      add(afterComma);
    }
    const stripped = skipPreamble(skipLeadingFrames(tokenizeTopic(clause)));
    if (stripped.length >= 1 && stripped.length <= 3) {
      add(stripped.join(" "));
    }
  }

  return phrases;
}

function userTopicKeys(text: string): string[] {
  return userTopicPhrases(text).map((phrase) => topicKey(tokenizeTopic(phrase)));
}

function tokensFromKey(key: string): string[] {
  return key.split("\u0001").filter(Boolean);
}

export function titleMatchesUserTopic(title: string, userKeys: Iterable<string>): boolean {
  const titleKey = topicKey(tokenizeTopic(title));
  if (!titleKey) return false;
  const titleTokens = tokensFromKey(titleKey);
  const titleTokenSet = new Set(titleTokens);
  for (const userKey of userKeys) {
    if (!userKey) continue;
    if (userKey === titleKey) return true;
    const userTokens = tokensFromKey(userKey);
    const userTokenSet = new Set(userTokens);
    if (userTokens.length === 0) continue;

    // Environment → Natural environment (qualifier extras on the title).
    if (userTokens.every((token) => titleTokenSet.has(token))) {
      const extra = titleTokens.filter((token) => !userTokenSet.has(token));
      if (extra.length === 0 || extra.every((token) => TITLE_QUALIFIERS.has(token))) {
        return true;
      }
    }

    // Digital Trade → Trade / Digital trade (title is a strong subset of the heading).
    if (titleTokens.every((token) => userTokenSet.has(token))) {
      if (titleTokens.length >= 2) return true;
      const solo = titleTokens[0]!;
      if (!WEAK_SOLO_TOPIC_TOKENS.has(solo) && solo.length >= 4) return true;
    }
  }
  return false;
}

function topicAliasQueries(phrase: string): string[] {
  const key = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  const aliases = TOPIC_SEARCH_ALIASES[key];
  return aliases ? [...aliases] : [];
}

function headingPermutations(phrase: string): string[] {
  const tokens = tokenizeTopic(phrase);
  if (tokens.length < 2 || tokens.length > 3) return [];
  if (tokens.length === 2) return [`${tokens[1]} ${tokens[0]}`];
  return [
    `${tokens[1]} ${tokens[0]} ${tokens[2]}`,
    `${tokens[2]} ${tokens[1]} ${tokens[0]}`,
    `${tokens[0]} ${tokens[2]} ${tokens[1]}`,
  ];
}

function liveSearchQueries(text: string): string[] {
  const phrases = userTopicPhrases(text);
  const queries: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
    const words = normalized.split(" ").filter(Boolean);
    if (!normalized || seen.has(normalized) || words.length === 0 || words.length > 16) return;
    seen.add(normalized);
    queries.push(value.trim());
  };
  for (const phrase of phrases) {
    push(phrase);
    const stripped = skipPreamble(skipLeadingFrames(tokenizeTopic(phrase)));
    if (stripped.length >= 1 && stripped.length <= 3) {
      push(stripped.join(" "));
    }
    for (const perm of headingPermutations(phrase)) push(perm);
    for (const alias of topicAliasQueries(phrase)) push(alias);
    if (stripped.length >= 2) {
      for (const alias of topicAliasQueries(stripped.join(" "))) push(alias);
    }
    // Digital Trade → also search "trade" and "digital" when they are strong tokens.
    for (const token of stripped) {
      if (token.length >= 4 && !WEAK_SOLO_TOPIC_TOKENS.has(token)) push(token);
    }
  }
  return queries
    .sort((left, right) => {
      const rank = (value: string) => {
        const normalized = value.toLowerCase();
        if (normalized === "e-commerce" || normalized === "electronic commerce") return 0;
        if (normalized.includes("commerce") || normalized.includes("trade")) return 1;
        if (normalized.includes("shopping")) return 3;
        return 2;
      };
      return rank(left) - rank(right) || right.length - left.length || left.localeCompare(right);
    })
    .slice(0, 12);
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
    rawExtract: row.rawExtract,
    topic: row.topic,
  };
}

/**
 * Local ~3000-row corpus helper (not used by Humanize).
 * Humanize uses the live English Wikipedia API for the full encyclopedia.
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

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_LIVE_INDEX = 90_000;
const WIKIPEDIA_USER_AGENT =
  "RefinoText/1.0 (https://refinotext.com; same-topic Wikipedia lookup for Humanize)";

const pageCache = new Map<string, WikipediaRow | null>();
const searchCache = new Map<string, string[]>();

export function isWikipediaLiveLookupEnabled(): boolean {
  return true;
}

type WikiApiPage = {
  missing?: boolean;
  invalid?: boolean;
  title?: string;
  extract?: string;
  fullurl?: string;
  pageprops?: { disambiguation?: unknown };
};

async function wikiQuery(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("utf8", "1");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": WIKIPEDIA_USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function liveRowFromExtract(title: string, extract: string, pageUrl: string): WikipediaRow | null {
  const output = formatWikipediaEditorText(
    title,
    extract,
    WIKIPEDIA_EDITOR_MAX_CHARS,
    WIKIPEDIA_EDITOR_MAX_PARAGRAPHS,
  );
  if (output.length < 120) return null;
  if (hasLatexDump(output)) return null;
  return {
    id: WIKIPEDIA_LIVE_INDEX,
    topic: title,
    category: "general",
    source_url: pageUrl,
    source_text: output,
    input: `${title}\n\n${output}`,
    output,
    aliases: [],
    rawExtract: extract,
    mathHeavy: (extract.match(/\\displaystyle/g) ?? []).length >= 3,
  };
}

function isDisambiguation(page: WikiApiPage): boolean {
  return Boolean(page.pageprops && "disambiguation" in page.pageprops);
}

async function fetchWikipediaPage(title: string): Promise<WikipediaRow | null> {
  const cacheKey = title.trim().toLowerCase();
  if (pageCache.has(cacheKey)) return pageCache.get(cacheKey) ?? null;

  const data = await wikiQuery({
    prop: "extracts|info|pageprops",
    explaintext: "1",
    exsectionformat: "plain",
    // Do not set exchars — MediaWiki caps it around 1200 chars and truncates mid-sentence.
    inprop: "url",
    ppprop: "disambiguation",
    redirects: "1",
    titles: title,
  });
  const query = data?.query as { pages?: WikiApiPage[] } | undefined;
  const page = query?.pages?.[0];
  if (!page || page.missing || page.invalid || isDisambiguation(page)) {
    pageCache.set(cacheKey, null);
    return null;
  }
  const canonical = page.title?.trim();
  const extract = page.extract?.trim();
  const pageUrl = page.fullurl?.trim();
  if (!canonical || !extract || !pageUrl) {
    pageCache.set(cacheKey, null);
    return null;
  }
  if (!pageUrl.startsWith("https://en.wikipedia.org/wiki/")) {
    pageCache.set(cacheKey, null);
    return null;
  }
  const row = liveRowFromExtract(canonical, extract, pageUrl);
  pageCache.set(cacheKey, row);
  if (canonical.toLowerCase() !== cacheKey) {
    pageCache.set(canonical.toLowerCase(), row);
  }
  return row;
}

async function searchWikipediaTitles(query: string, limit = 12): Promise<string[]> {
  const cacheKey = `${query.trim().toLowerCase()}\u0001${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const data = await wikiQuery({
    list: "search",
    srsearch: query,
    srnamespace: "0",
    srlimit: String(limit),
  });
  const queryData = data?.query as { search?: Array<{ title?: string }> } | undefined;
  const titles: string[] = [];
  for (const hit of queryData?.search ?? []) {
    const title = hit.title?.trim();
    if (title) titles.push(title);
  }
  searchCache.set(cacheKey, titles);
  return titles;
}

function userDraftHasLatex(text: string): boolean {
  return /\\displaystyle|\{\s*\\display|\\varphi|\\frac\{/i.test(text);
}

function preferProsePage(userText: string, page: WikipediaRow): boolean {
  if (!page.mathHeavy) return true;
  return userDraftHasLatex(userText);
}

function draftBodyText(text: string): string {
  const trimmed = text.trim();
  const heading = extractHeadingLine(trimmed);
  if (!heading) return trimmed;
  const lines = trimmed.split(/\n/);
  const first = lines[0]?.trim() ?? "";
  const firstPlain = first
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
  if (firstPlain.toLowerCase() === heading.toLowerCase()) {
    return lines.slice(1).join("\n").trim();
  }
  return trimmed;
}

/** Frequent content words from the draft body — used to reject title-only collisions. */
function contentTopicTokens(text: string): string[] {
  const body = draftBodyText(text);
  if (!body) return [];
  const counts = new Map<string, number>();
  for (const token of tokenizeTopic(body)) {
    if (TOPIC_PREAMBLE.has(token) || LEADING_TOPIC_FRAMES.has(token)) continue;
    if (token.length < 4 && !SHORT_TOPIC_TERMS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([token]) => token)
    .slice(0, 24);
}

function contentOverlapRatio(extract: string, contentTokens: readonly string[]): number {
  if (contentTokens.length === 0) return 0;
  const extractTokens = new Set(tokenizeTopic(extract));
  let hit = 0;
  for (const token of contentTokens) {
    if (extractTokens.has(token)) hit += 1;
  }
  return hit / contentTokens.length;
}

const ENTITY_LEAD_PATTERN =
  /\bis (?:an?|the)\b[\s\S]{0,100}\b(?:company|retailer|manufacturer|corporation|business|organization|organisation|nonprofit|website|brand|startup|store|shop|founder|entrepreneur|musician|singer|rapper|composer|actor|actress|politician|footballer|athlete|writer|author|artist|painter|poet|band|dj)\b/i;

const PERSON_BIO_LEAD_PATTERN =
  /^(?:[A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+){1,4}\b[\s\S]{0,120}\b(?:born|known professionally as|known as|is an English|is an American|is a British|is a Canadian)\b/u;

function draftLooksLikeEntityBio(text: string): boolean {
  const lead = draftBodyText(text).slice(0, 500);
  return ENTITY_LEAD_PATTERN.test(lead) || PERSON_BIO_LEAD_PATTERN.test(lead);
}

function pageAlignsWithDraft(
  page: WikipediaRow,
  userText: string,
  contentTokens: readonly string[],
): boolean {
  const extract = page.output || page.source_text;
  const lead = extract.replace(/^#\s+[^\n]+\n*/, "").slice(0, 520);
  if (
    (ENTITY_LEAD_PATTERN.test(lead) || PERSON_BIO_LEAD_PATTERN.test(lead)) &&
    !draftLooksLikeEntityBio(userText)
  ) {
    return false;
  }
  if (contentTokens.length < 4) return true;
  const sample = contentTokens.slice(0, 16);
  const ratio = contentOverlapRatio(extract, sample);
  // Soft gate: prefer same-topic pages; do not over-reject related encyclopedia leads.
  return ratio >= 0.08 || contentTokens.length < 8;
}

function strongUserTopicTokens(userKeys: Iterable<string>): string[] {
  const tokens = new Set<string>();
  for (const key of userKeys) {
    for (const token of tokensFromKey(key)) {
      if (token.length >= 4 && !WEAK_SOLO_TOPIC_TOKENS.has(token)) tokens.add(token);
    }
  }
  return [...tokens];
}

/**
 * Broader live search when an exact title miss happens — still rejects bios and
 * weak keyword traps (Jack Dangers / Internet of things).
 */
async function findClosestLiveWikipediaPage(
  userText: string,
  userKeys: Set<string>,
  contentTokens: readonly string[],
): Promise<WikipediaRow | null> {
  const strongTokens = strongUserTopicTokens(userKeys);
  if (strongTokens.length === 0) return null;

  let best: { row: WikipediaRow; score: number } | null = null;
  const seen = new Set<string>();

  for (const query of liveSearchQueries(userText).slice(0, 10)) {
    for (const title of await searchWikipediaTitles(query, 10)) {
      const key = title.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const titleTokens = tokenizeTopic(title);
      const sharedStrong = titleTokens.filter((token) => strongTokens.includes(token));
      if (sharedStrong.length === 0 && !titleMatchesUserTopic(title, userKeys)) continue;

      const page = await fetchWikipediaPage(title);
      if (!page) continue;
      if (!preferProsePage(userText, page)) continue;
      if (!pageAlignsWithDraft(page, userText, contentTokens)) continue;

      const overlap = contentOverlapRatio(page.output || page.source_text, contentTokens.slice(0, 16));
      let score = sharedStrong.length * 2 + overlap * 4;
      if (titleMatchesUserTopic(title, userKeys)) score += 5;
      for (const userKey of userKeys) {
        const phrase = tokensFromKey(userKey).join(" ");
        for (const alias of topicAliasQueries(phrase)) {
          if (topicKey(tokenizeTopic(alias)) === topicKey(titleTokens)) {
            score += 3;
            break;
          }
        }
      }
      if (!best || score > best.score) best = { row: page, score };
    }
  }

  return best && best.score >= 2 ? best.row : null;
}

function queryBelongsToUserTopic(query: string, userKeys: Set<string>): boolean {
  const queryKey = topicKey(tokenizeTopic(query));
  if (!queryKey) return false;
  if (userKeys.has(queryKey)) return true;

  const queryTokens = tokensFromKey(queryKey);
  for (const userKey of userKeys) {
    const userTokens = new Set(tokensFromKey(userKey));
    if (queryTokens.every((token) => userTokens.has(token))) {
      if (queryTokens.length >= 2) return true;
      const solo = queryTokens[0]!;
      if (!WEAK_SOLO_TOPIC_TOKENS.has(solo) && solo.length >= 4) return true;
    }
    const phrase = tokensFromKey(userKey).join(" ");
    for (const alias of topicAliasQueries(phrase)) {
      if (topicKey(tokenizeTopic(alias)) === queryKey) return true;
    }
  }
  return false;
}

/**
 * Look up the draft on the full English Wikipedia API (not the local 3000-row file).
 * Same/related topic pages win; weak keyword collisions are rejected so Humanize
 * can fall back to the tuned model only when nothing fits.
 */
export async function findWikipediaLiveMatch(userText: string): Promise<DatabaseTrainingMatch | null> {
  if (typeof userText !== "string" || userText.trim().length === 0) return null;
  const userKeys = new Set(userTopicKeys(userText));
  if (userKeys.size === 0) return null;
  const contentTokens = contentTopicTokens(userText);

  let mathFallback: WikipediaRow | null = null;

  for (const query of liveSearchQueries(userText)) {
    const queryKey = topicKey(tokenizeTopic(query));
    if (!queryKey || !queryBelongsToUserTopic(query, userKeys)) continue;

    const exact = await fetchWikipediaPage(query);
    if (exact) {
      if (!preferProsePage(userText, exact)) {
        mathFallback ??= exact;
      } else if (
        (titleMatchesUserTopic(exact.topic, userKeys) ||
          topicKey(tokenizeTopic(exact.topic)) === queryKey) &&
        pageAlignsWithDraft(exact, userText, contentTokens)
      ) {
        return toMatch(exact, 0.97, "topic");
      }
    }

    for (const title of await searchWikipediaTitles(query, 12)) {
      if (
        !titleMatchesUserTopic(title, userKeys) &&
        topicKey(tokenizeTopic(title)) !== queryKey
      ) {
        continue;
      }
      const page = await fetchWikipediaPage(title);
      if (!page) continue;
      if (!preferProsePage(userText, page)) {
        mathFallback ??= page;
        continue;
      }
      if (!pageAlignsWithDraft(page, userText, contentTokens)) continue;
      return toMatch(page, 0.95, "topic");
    }
  }

  if (mathFallback && pageAlignsWithDraft(mathFallback, userText, contentTokens)) {
    return toMatch(mathFallback, 0.8, "topic");
  }

  const related = await findClosestLiveWikipediaPage(userText, userKeys, contentTokens);
  if (related) return toMatch(related, 0.88, "topic");

  return null;
}

function toArticle(row: WikipediaRow): WikipediaArticle {
  return {
    id: row.id,
    topic: row.topic,
    category: row.category,
    source_url: row.source_url,
    source_text: row.source_text,
  };
}

export async function lookupWikipediaArticle(query: string): Promise<WikipediaArticle | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const exact = await fetchWikipediaPage(trimmed);
  if (exact) return toArticle(exact);
  for (const title of await searchWikipediaTitles(trimmed)) {
    const page = await fetchWikipediaPage(title);
    if (page) return toArticle(page);
  }
  return null;
}
