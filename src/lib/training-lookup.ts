import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const TRAINING_DATASET_FILENAME = "training_data.jsonl";

export type TrainingPair = {
  index: number;
  input: string;
  output: string;
};

export type TrainingMatch = {
  index: number;
  input: string;
  output: string;
};

type TrainingIndex = {
  path: string;
  rows: TrainingPair[];
  byInput: Map<string, TrainingMatch>;
  byNormalized: Map<string, TrainingMatch>;
  byOutput: Map<string, TrainingMatch>;
  byNormalizedOutput: Map<string, TrainingMatch>;
  malformedLines: number;
  duplicateInputs: number;
};

function candidatePaths(): string[] {
  const filename = TRAINING_DATASET_FILENAME;
  return [
    path.join(process.cwd(), "data", filename),
    path.join(process.cwd(), TRAINING_DATASET_FILENAME),
    path.resolve(__dirname, "../../data", filename),
    path.resolve(__dirname, "../../../data", filename),
  ];
}

export function resolveTrainingDatasetPath(): string {
  for (const candidate of candidatePaths()) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error("The training dataset is not available on the server.");
}

function parsePair(value: unknown, index: number): TrainingPair | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const input = row.input ?? row.ai_text;
  const output = row.output ?? row.human_text;
  if (typeof input !== "string" || typeof output !== "string") return null;
  return { index, input, output };
}

function loadIndex(): TrainingIndex {
  const datasetPath = resolveTrainingDatasetPath();
  const bytes = readFileSync(datasetPath);
  const text =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      ? bytes.subarray(3).toString("utf8")
      : bytes.toString("utf8");

  const rows: TrainingPair[] = [];
  const byInput = new Map<string, TrainingMatch>();
  const byNormalized = new Map<string, TrainingMatch>();
  const byOutput = new Map<string, TrainingMatch>();
  const byNormalizedOutput = new Map<string, TrainingMatch>();
  let malformedLines = 0;
  let duplicateInputs = 0;
  let index = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    const pair = parsePair(parsed, index);
    if (!pair) {
      malformedLines += 1;
      continue;
    }

    rows.push(pair);
    const match = { index: pair.index, input: pair.input, output: pair.output };
    if (byInput.has(pair.input)) {
      duplicateInputs += 1;
    } else {
      byInput.set(pair.input, match);
    }
    const normalized = normalizeInsignificant(pair.input);
    if (normalized && !byNormalized.has(normalized)) {
      byNormalized.set(normalized, match);
    }
    if (!byOutput.has(pair.output)) {
      byOutput.set(pair.output, match);
    }
    const normalizedOutput = normalizeInsignificant(pair.output);
    if (normalizedOutput && !byNormalizedOutput.has(normalizedOutput)) {
      byNormalizedOutput.set(normalizedOutput, match);
    }
    index += 1;
  }

  console.info("[humanize] loaded training dataset", {
    path: TRAINING_DATASET_FILENAME,
    rows: rows.length,
    lookupKeys: byInput.size,
    malformedLines,
    duplicateInputs,
  });

  return {
    path: datasetPath,
    rows,
    byInput,
    byNormalized,
    byOutput,
    byNormalizedOutput,
    malformedLines,
    duplicateInputs,
  };
}

let cached: TrainingIndex | null = null;

function getIndex(): TrainingIndex {
  if (!cached) cached = loadIndex();
  return cached;
}

export function getTrainingRowCount(): number {
  return getIndex().rows.length;
}

export function getTrainingPairs(): readonly TrainingPair[] {
  return getIndex().rows;
}

export function getTrainingLookupStats(): {
  rows: number;
  lookupKeys: number;
  malformedLines: number;
  duplicateInputs: number;
} {
  const index = getIndex();
  return {
    rows: index.rows.length,
    lookupKeys: index.byInput.size,
    malformedLines: index.malformedLines,
    duplicateInputs: index.duplicateInputs,
  };
}

function normalizeLookupKey(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Collapse spacing, line breaks, punctuation, and capitalization so the same
 * draft still matches when those details differ.
 */
export function normalizeInsignificant(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return the stored human_text for an exact ai_text/input match.
 * The stored output is returned unchanged.
 */
export function findExactTrainingMatch(userText: string): TrainingMatch | null {
  if (typeof userText !== "string" || userText.length === 0) return null;

  const { byInput } = getIndex();
  const direct = byInput.get(userText);
  if (direct) return direct;

  const normalized = normalizeLookupKey(userText);
  if (normalized !== userText) {
    const match = byInput.get(normalized);
    if (match) return match;
  }

  return null;
}

/**
 * Same draft after ignoring spacing, punctuation, and capitalization.
 */
export function findNormalizedTrainingMatch(userText: string): TrainingMatch | null {
  if (typeof userText !== "string" || userText.length === 0) return null;
  const normalized = normalizeInsignificant(userText);
  if (!normalized) return null;
  return getIndex().byNormalized.get(normalized) ?? null;
}

/**
 * Return the stored human_text when the user pasted that human_text itself.
 * Do not send gold outputs through the model.
 */
export function findExactTrainingOutputMatch(userText: string): TrainingMatch | null {
  if (typeof userText !== "string" || userText.length === 0) return null;

  const { byOutput } = getIndex();
  const direct = byOutput.get(userText);
  if (direct) return direct;

  const normalized = normalizeLookupKey(userText);
  if (normalized !== userText) {
    const match = byOutput.get(normalized);
    if (match) return match;
  }

  return null;
}

export function findNormalizedTrainingOutputMatch(userText: string): TrainingMatch | null {
  if (typeof userText !== "string" || userText.length === 0) return null;
  const normalized = normalizeInsignificant(userText);
  if (!normalized) return null;
  return getIndex().byNormalizedOutput.get(normalized) ?? null;
}
