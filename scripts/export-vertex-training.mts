/**
 * Convert training rewrite pairs into Vertex supervised tuning JSONL.
 *
 * Prefers data/training_data_full.jsonl (existing essays + Wikipedia pairs)
 * when present; otherwise uses data/training_data.jsonl.
 *
 * Teaches the rewrite edit:
 *   user  = ai_text  (stiff draft)
 *   model = human_text (gold rewrite)
 *
 * Vertex requires validation size ≤ 30% of training size. Training keeps every
 * pair; validation is a deterministic ~15% subsample (well under the cap).
 *
 * Run: npm run export:vertex-training
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { HUMAN_REWRITE_SYSTEM_INSTRUCTION } from "../src/lib/humanize-prompt";

const fullSourcePath = join(process.cwd(), "data", "training_data_full.jsonl");
const legacySourcePath = join(process.cwd(), "data", "training_data.jsonl");
const sourcePath = existsSync(fullSourcePath) ? fullSourcePath : legacySourcePath;
const trainPath = join(process.cwd(), "data", "humanizer_train_v4.jsonl");
const validationPath = join(process.cwd(), "data", "humanizer_validation_v4.jsonl");

/** Keep validation under Vertex's 30% of training limit (use ~15%). */
const VALIDATION_FRACTION = 0.15;
const MAX_VALIDATION_RATIO = 0.3;

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
  throw new Error(`Expected at least 700 rewrite pairs, got ${exported.length} rows.`);
}

const trainBody = `${exported.join("\n")}\n`;
writeFileSync(trainPath, trainBody, "utf8");

const maxValidation = Math.floor(exported.length * MAX_VALIDATION_RATIO);
const targetValidation = Math.min(
  maxValidation,
  Math.max(50, Math.floor(exported.length * VALIDATION_FRACTION)),
);

const ranked = exported
  .map((row, index) => ({
    row,
    rank: createHash("sha256").update(row).digest("hex"),
    index,
  }))
  .sort((left, right) => left.rank.localeCompare(right.rank) || left.index - right.index);

const validationRows = ranked.slice(0, targetValidation).map((entry) => entry.row);
if (validationRows.length > maxValidation) {
  throw new Error(
    `Validation ${validationRows.length} exceeds 30% of training ${exported.length} (max ${maxValidation}).`,
  );
}

writeFileSync(validationPath, `${validationRows.join("\n")}\n`, "utf8");

console.log(`Source: ${sourcePath}`);
console.log(
  `Training rows: ${exported.length} of ${lines.length} (every stored pair, ai_text → human_text, skipped ${skippedIdentity} identical pairs) → ${trainPath}`,
);
console.log(
  `Validation rows: ${validationRows.length} (~${Math.round((validationRows.length / exported.length) * 100)}% of training, Vertex max 30%) → ${validationPath}`,
);

const downloads = join("C:/Users/hp/Downloads");
try {
  copyFileSync(trainPath, join(downloads, "humanizer_trainOG_v4.jsonl"));
  copyFileSync(validationPath, join(downloads, "humanizer_validationOG_v4.jsonl"));
  console.log("Also copied both files to Downloads for Vertex console upload.");
} catch {
  // Downloads may be unavailable in CI.
}
