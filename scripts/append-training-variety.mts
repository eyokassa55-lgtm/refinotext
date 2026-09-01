/**
 * Append varied human-style training pairs to data/training_data.jsonl.
 * Run: npm run append:training
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "data", "training_variety.jsonl");
const target = join(process.cwd(), "data", "training_data.jsonl");

const rows = readFileSync(source, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

for (const row of rows) {
  JSON.parse(row);
}

appendFileSync(target, rows.map((row) => `${row}\n`).join(""));

const total = readFileSync(target, "utf8")
  .split(/\r?\n/)
  .filter(Boolean).length;

console.log(`Appended ${rows.length} varied training pair(s). Total rows: ${total}.`);
console.log("Next: upload training_data.jsonl to GCS, then run npm run train:vertex");
