import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "data", "wikipedia_training_pairs.jsonl");
const dest = join(process.cwd(), "data", "wikipedia_style_examples.jsonl");
const lines = readFileSync(source, "utf8").split(/\r?\n/).filter(Boolean);
const picks = [0, 100, 500, 1000, 2000, 3500, 5000, 7000, 9000, 11000, 13000, 15000, 17000, 19000, 19999];
const out: Array<{ input: string; output: string }> = [];

for (const index of picks) {
  const line = lines[index];
  if (!line) continue;
  const row = JSON.parse(line) as { input?: string; output?: string };
  const input = String(row.input ?? "").slice(0, 900).trim();
  const output = String(row.output ?? "").slice(0, 900).trim();
  if (!input || !output || input === output) continue;
  out.push({ input, output });
}

writeFileSync(dest, `${out.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(`wrote ${out.length} style examples → ${dest}`);
