/**
 * Convert data/training_data.jsonl into Vertex supervised tuning JSONL.
 *
 * Run: npm run export:vertex-training
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HUMAN_REWRITE_SYSTEM_INSTRUCTION } from "../src/lib/humanize-prompt";

const sourcePath = join(process.cwd(), "data", "training_data.jsonl");
const outputPath = join(process.cwd(), "data", "humanizer_train_v2.jsonl");

const systemText = HUMAN_REWRITE_SYSTEM_INSTRUCTION;
const lines = readFileSync(sourcePath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

const exported = lines.map((line) => {
  const row = JSON.parse(line) as { input?: string; output?: string; ai_text?: string; human_text?: string };
  const input = row.input ?? row.ai_text ?? "";
  const output = row.output ?? row.human_text ?? "";
  if (!input || !output) {
    throw new Error("Training row is missing input/output.");
  }
  return JSON.stringify({
    systemInstruction: {
      role: "system",
      parts: [{ text: systemText }],
    },
    contents: [
      { role: "user", parts: [{ text: input }] },
      { role: "model", parts: [{ text: output }] },
    ],
  });
});

writeFileSync(outputPath, `${exported.join("\n")}\n`, "utf8");
console.log(`Exported ${exported.length} rows to ${outputPath}`);
