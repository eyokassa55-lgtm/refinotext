/**
 * Convert data/training_data.jsonl into Vertex supervised tuning JSONL.
 * Trains on stored human_text only. The AI draft (ai_text / input) is not
 * used, so the tuned model learns the gold human voice instead of mapping
 * one stored AI essay onto another.
 *
 * Writes the full 722-row set to both training and validation files.
 * Do not hold out a 90-row validation split — OG REFINO did that and
 * those pairs never updated the weights.
 *
 * Run: npm run export:vertex-training
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HUMAN_REWRITE_SYSTEM_INSTRUCTION } from "../src/lib/humanize-prompt";

const sourcePath = join(process.cwd(), "data", "training_data.jsonl");
const trainPath = join(process.cwd(), "data", "humanizer_train_v3.jsonl");
const validationPath = join(process.cwd(), "data", "humanizer_validation_v3.jsonl");

const systemText = HUMAN_REWRITE_SYSTEM_INSTRUCTION;
const lines = readFileSync(sourcePath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

const exported = lines.map((line) => {
  const row = JSON.parse(line) as { output?: string; human_text?: string };
  const humanText = row.output ?? row.human_text ?? "";
  if (!humanText) {
    throw new Error("Training row is missing human_text.");
  }
  return JSON.stringify({
    systemInstruction: {
      role: "system",
      parts: [{ text: systemText }],
    },
    contents: [
      { role: "user", parts: [{ text: humanText }] },
      { role: "model", parts: [{ text: humanText }] },
    ],
  });
});

if (exported.length < 700) {
  throw new Error(`Expected the full training set, got ${exported.length} rows.`);
}

const body = `${exported.join("\n")}\n`;
writeFileSync(trainPath, body, "utf8");
writeFileSync(validationPath, body, "utf8");
console.log(`Training rows: ${exported.length} (human_text only) → ${trainPath}`);
console.log(`Validation rows: ${exported.length} (full set, not a 90-row holdout) → ${validationPath}`);

const downloads = join("C:/Users/hp/Downloads");
try {
  copyFileSync(trainPath, join(downloads, "humanizer_trainOG_v3.jsonl"));
  copyFileSync(validationPath, join(downloads, "humanizer_validationOG_v3.jsonl"));
  console.log("Also copied both files to Downloads for Vertex console upload.");
} catch {
  // Downloads may be unavailable in CI.
}
