/**
 * Convert the local Wikipedia corpus into Vertex fine-tune rewrite pairs.
 *
 * For each article:
 *   input  = stiff AI-sounding paraphrase of the same facts (student draft)
 *   output = clean Wikipedia prose (gold human / encyclopedia voice)
 *
 * Writes:
 *   data/wikipedia_training_pairs.jsonl  — wiki-only pairs
 *   data/training_data_full.jsonl        — existing training_data + wiki pairs
 *
 * Run: npm run build:wikipedia-training
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const wikiPath = join(process.cwd(), "data", "wikipedia_750.jsonl");
const existingPath = join(process.cwd(), "data", "training_data.jsonl");
const wikiPairsPath = join(process.cwd(), "data", "wikipedia_training_pairs.jsonl");
const fullPath = join(process.cwd(), "data", "training_data_full.jsonl");

type WikiRow = {
  topic?: string;
  source_text?: string;
  category?: string;
};

const OPENERS = [
  "It is important to note that",
  "In today's world,",
  "At its core,",
  "Broadly speaking,",
  "One can observe that",
  "It should be emphasized that",
  "From a general perspective,",
];

const TRANSITIONS = [
  "Furthermore,",
  "Moreover,",
  "Additionally,",
  "Consequently,",
  "In addition,",
  "It is also worth noting that",
  "This underscores that",
];

const CLOSERS = [
  "In conclusion, this topic remains crucial in understanding the broader landscape.",
  "Ultimately, these points highlight the significance of the subject.",
  "Overall, it is clear that this area continues to play a pivotal role.",
];

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 20);
}

function hashPick<T>(seed: string, items: readonly T[]): T {
  const digest = createHash("sha256").update(seed).digest();
  const index = digest[0]! % items.length;
  return items[index]!;
}

function stiffenSentence(sentence: string, seed: string): string {
  let text = sentence.trim();
  if (!/[.!?]$/.test(text)) text = `${text}.`;

  // Mild synonym / template padding that reads like common LLM essay fluff.
  text = text
    .replace(/\bimportant\b/gi, "crucial")
    .replace(/\bkey\b/gi, "pivotal")
    .replace(/\bshows?\b/gi, "underscores")
    .replace(/\bhelps?\b/gi, "serves to facilitate")
    .replace(/\bused\b/gi, "utilized")
    .replace(/\bmake(?:s|ing)?\b/gi, "enable")
    .replace(/\bbecause\b/gi, "due to the fact that");

  if (!/^(It is|In today|At its|Broadly|One can|From a)/i.test(text) && text.length > 40) {
    if (createHash("sha256").update(`${seed}:opener`).digest()[0]! % 3 === 0) {
      const opener = hashPick(`${seed}:opener-word`, OPENERS);
      text = `${opener} ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
  }
  return text;
}

/**
 * Build a stiff AI draft from Wikipedia prose while keeping the same facts.
 * Deterministic per topic so re-runs stay stable.
 */
export function wikipediaToAiDraft(topic: string, sourceText: string): string {
  const sentences = splitSentences(normalizeSpace(sourceText));
  if (sentences.length === 0) return "";

  const keep = Math.min(sentences.length, 10);
  const selected = sentences.slice(0, keep).map((sentence, index) =>
    stiffenSentence(sentence, `${topic}:${index}`),
  );

  const paragraphs: string[] = [];
  const first = selected[0]!;
  paragraphs.push(
    `${topic} is a significant subject that continues to shape understanding across related fields. ${first}`,
  );

  const mid = selected.slice(1, Math.max(2, selected.length - 1));
  if (mid.length > 0) {
    const withTransitions = mid.map((sentence, index) => {
      if (index === 0) return sentence;
      if (createHash("sha256").update(`${topic}:tr:${index}`).digest()[0]! % 2 === 0) {
        return `${hashPick(`${topic}:tr-word:${index}`, TRANSITIONS)} ${sentence}`;
      }
      return sentence;
    });
    paragraphs.push(withTransitions.join(" "));
  }

  const last = selected[selected.length - 1]!;
  const closer = hashPick(`${topic}:closer`, CLOSERS);
  if (selected.length > 2) {
    paragraphs.push(`${last} ${closer}`);
  } else {
    paragraphs.push(closer);
  }

  return paragraphs.join("\n\n").trim();
}

function formatHumanOutput(topic: string, sourceText: string): string {
  const body = normalizeSpace(sourceText);
  // Keep encyclopedia voice; light paragraph breaks every ~3 sentences.
  const sentences = splitSentences(body);
  if (sentences.length <= 3) {
    return `${topic}\n\n${body}`;
  }
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    chunks.push(sentences.slice(i, i + 3).join(" "));
  }
  return `${topic}\n\n${chunks.join("\n\n")}`.trim();
}

function loadJsonl(path: string): string[] {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function pairKey(input: string, output: string): string {
  return createHash("sha256").update(`${input}\n---\n${output}`).digest("hex");
}

function main() {
  const wikiLines = loadJsonl(wikiPath);
  if (wikiLines.length === 0) {
    throw new Error(`No Wikipedia rows found at ${wikiPath}`);
  }

  const wikiPairs: Array<{ input: string; output: string; topic: string }> = [];
  let skippedShort = 0;
  let skippedIdentity = 0;

  for (const line of wikiLines) {
    const row = JSON.parse(line) as WikiRow;
    const topic = (row.topic ?? "").trim();
    const source = (row.source_text ?? "").trim();
    if (!topic || source.length < 400) {
      skippedShort += 1;
      continue;
    }
    const input = wikipediaToAiDraft(topic, source);
    const output = formatHumanOutput(topic, source);
    if (!input || !output) {
      skippedShort += 1;
      continue;
    }
    if (input === output) {
      skippedIdentity += 1;
      continue;
    }
    wikiPairs.push({ input, output, topic });
  }

  const wikiBody = `${wikiPairs.map(({ input, output }) => JSON.stringify({ input, output })).join("\n")}\n`;
  writeFileSync(wikiPairsPath, wikiBody, "utf8");

  const existingLines = loadJsonl(existingPath);
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const line of existingLines) {
    const row = JSON.parse(line) as { input?: string; output?: string; ai_text?: string; human_text?: string };
    const input = (row.input ?? row.ai_text ?? "").trim();
    const output = (row.output ?? row.human_text ?? "").trim();
    if (!input || !output || input === output) continue;
    const key = pairKey(input, output);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(JSON.stringify({ input, output }));
  }

  const existingCount = merged.length;
  for (const pair of wikiPairs) {
    const key = pairKey(pair.input, pair.output);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(JSON.stringify({ input: pair.input, output: pair.output }));
  }

  writeFileSync(fullPath, `${merged.join("\n")}\n`, "utf8");

  console.log(`Wikipedia source rows: ${wikiLines.length}`);
  console.log(`Wikipedia training pairs: ${wikiPairs.length} (skipped short=${skippedShort}, identity=${skippedIdentity})`);
  console.log(`Existing rewrite pairs kept: ${existingCount}`);
  console.log(`Merged fine-tune set: ${merged.length} → ${fullPath}`);
  console.log(`Wiki-only pairs: ${wikiPairsPath}`);
  console.log("Next: npm run export:vertex-training");
}

main();
