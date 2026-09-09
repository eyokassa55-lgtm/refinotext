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

/** Pick one Wikipedia-training AFTER example as cadence reference (not content to copy). */
export function pickWikipediaStyleExample(seedText: string): WikipediaStyleExample | null {
  const examples = loadExamples();
  if (examples.length === 0) return null;
  const digest = createHash("sha256").update(seedText).digest();
  const index = digest[0]! % examples.length;
  return examples[index] ?? null;
}
