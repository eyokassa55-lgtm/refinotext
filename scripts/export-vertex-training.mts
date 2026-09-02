/**
 * Convert data/training_data.jsonl into Vertex supervised tuning JSONL.
 * Writes the full 722-pair set to both training and validation files.
 * Do not hold out a 90-row validation split — OG REFINO did that and
 * those pairs never updated the weights.
 *
 * Run: npm run export:vertex-training
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HUMAN_REWRITE_SYSTEM_INSTRUCTION } from "../src/lib/humanize-prompt";

const sourcePath = join(process.cwd(), "data", "training_data.jsonl");
const trainPath = join(process.cwd(), "data", "humanizer_train_v2.jsonl");
const validationPath = join(process.cwd(), "data", "humanizer_validation_v2.jsonl");

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

if (exported.length < 700) {
  throw new Error(`Expected the full training set, got ${exported.length} rows.`);
}

const body = `${exported.join("\n")}\n`;
writeFileSync(trainPath, body, "utf8");
writeFileSync(validationPath, body, "utf8");
console.log(`Training rows: ${exported.length} → ${trainPath}`);
console.log(`Validation rows: ${exported.length} (full set, not a 90-row holdout) → ${validationPath}`);

const downloads = join("C:/Users/hp/Downloads");
try {
  copyFileSync(trainPath, join(downloads, "humanizer_trainOG_v2.jsonl"));
  copyFileSync(validationPath, join(downloads, "humanizer_validationOG_v2.jsonl"));
  console.log("Also copied both files to Downloads for Vertex console upload.");
} catch {
  // Downloads may be unavailable in CI.
}
