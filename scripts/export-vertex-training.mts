/**
 * Convert data/training_data.jsonl into Vertex supervised tuning JSONL.
 *
 * Uses every stored pair — every topic, not one subject. Identity training
 * (human_text → human_text) makes the model lazy: at inference it copies
 * the user's draft. Each gold human_text already reads as human. This export
 * teaches the actual edit for the full set:
 *   user  = ai_text  (stiff draft)
 *   model = human_text (gold rewrite)
 *
 * The system line is a rewrite task, not “find the matching stored essay,”
 * so a related stored paper must not replace the user's draft.
 *
 * Writes the full 722-row set to both training and validation files.
 * No topic filter. Do not hold out a 90-row holdout.
 *
 * Run: npm run export:vertex-training
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HUMAN_REWRITE_SYSTEM_INSTRUCTION } from "../src/lib/humanize-prompt";

const sourcePath = join(process.cwd(), "data", "training_data.jsonl");
const trainPath = join(process.cwd(), "data", "humanizer_train_v4.jsonl");
const validationPath = join(process.cwd(), "data", "humanizer_validation_v4.jsonl");

const systemText = HUMAN_REWRITE_SYSTEM_INSTRUCTION;
const lines = readFileSync(sourcePath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

let skippedIdentity = 0;
const exported = lines.flatMap((line) => {
  const row = JSON.parse(line) as {
    input?: string;
    output?: string;
    ai_text?: string;
    human_text?: string;
  };
  const aiText = (row.input ?? row.ai_text ?? "").replace(/^\uFEFF/, "").trim();
  const humanText = (row.output ?? row.human_text ?? "").replace(/^\uFEFF/, "").trim();
  if (!aiText || !humanText) {
    throw new Error("Training row is missing ai_text or human_text.");
  }
  if (aiText === humanText) {
    skippedIdentity += 1;
    return [];
  }
  return [
    JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: systemText }],
      },
      contents: [
        { role: "user", parts: [{ text: aiText }] },
        { role: "model", parts: [{ text: humanText }] },
      ],
    }),
  ];
});

if (exported.length + skippedIdentity !== lines.length) {
  throw new Error(
    `Export must include every stored pair. Got ${exported.length} rewrites from ${lines.length} rows.`,
  );
}
if (exported.length < 700) {
  throw new Error(`Expected the full rewrite set, got ${exported.length} rows.`);
}

const body = `${exported.join("\n")}\n`;
writeFileSync(trainPath, body, "utf8");
writeFileSync(validationPath, body, "utf8");
console.log(
  `Training rows: ${exported.length} of ${lines.length} (every stored pair, ai_text → human_text, skipped ${skippedIdentity} identical pairs, no topic filter) → ${trainPath}`,
);
console.log(`Validation rows: ${exported.length} (full set, not a 90-row holdout) → ${validationPath}`);

const downloads = join("C:/Users/hp/Downloads");
try {
  copyFileSync(trainPath, join(downloads, "humanizer_trainOG_v4.jsonl"));
  copyFileSync(validationPath, join(downloads, "humanizer_validationOG_v4.jsonl"));
  console.log("Also copied both files to Downloads for Vertex console upload.");
} catch {
  // Downloads may be unavailable in CI.
}
