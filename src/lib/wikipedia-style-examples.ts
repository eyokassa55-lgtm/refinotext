import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type WikipediaStyleExample = {
  input: string;
  output: string;
};

let cached: WikipediaStyleExample[] | null = null;

function loadExamples(): WikipediaStyleExample[] {
  if (cached) return cached;
  const path = join(process.cwd(), "data", "wikipedia_style_examples.jsonl");
  if (!existsSync(path)) {
    cached = [];
    return cached;
  }
  cached = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const row = JSON.parse(line) as { input?: string; output?: string };
        const input = String(row.input ?? "").trim();
        const output = String(row.output ?? "").trim();
        if (!input || !output || input === output) return [];
        return [{ input, output }];
      } catch {
        return [];
      }
    });
  return cached;
}

/** Pick Wikipedia-training BEFORE→AFTER examples as cadence references (not content to copy). */
export function pickWikipediaStyleExamples(
  seedText: string,
  count = 2,
): WikipediaStyleExample[] {
  const examples = loadExamples();
  if (examples.length === 0) return [];
  const digest = createHash("sha256").update(seedText).digest();
  const start = digest[0]! % examples.length;
  const picked: WikipediaStyleExample[] = [];
  for (let offset = 0; offset < examples.length && picked.length < count; offset += 1) {
    const example = examples[(start + offset) % examples.length];
    if (!example) continue;
    if (picked.some((row) => row.output === example.output)) continue;
    picked.push(example);
  }
  return picked;
}

/** @deprecated Prefer pickWikipediaStyleExamples */
export function pickWikipediaStyleExample(seedText: string): WikipediaStyleExample | null {
  return pickWikipediaStyleExamples(seedText, 1)[0] ?? null;
}
