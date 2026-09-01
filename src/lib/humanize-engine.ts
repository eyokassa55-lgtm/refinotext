import "server-only";

import { getTrainingRowCount } from "@/lib/training-lookup";
import { findDatabaseMatch } from "@/lib/training-retrieval";
import type { HumanizeApiSource } from "@/lib/training-schema";

export type HumanizeRequest = {
  text: string;
  tone?: string;
  readability?: string;
  intensity?: number;
};

export type HumanizeSource = "EXACT_TRAINING_MATCH" | "DATABASE_SIMILARITY_MATCH" | "FINE_TUNED_MODEL";

export type HumanizeRetrievalMatch = {
  index: number;
  score: number;
};

export type HumanizeRetrievalSummary = {
  band: "exact" | "high";
  matches: HumanizeRetrievalMatch[];
};

export type HumanizeResult = {
  text: string;
  source: HumanizeSource;
  retrieval: HumanizeRetrievalSummary | null;
};

export class HumanizationFailedError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code = "HUMANIZATION_FAILED", status?: number) {
    super(message);
    this.name = "HumanizationFailedError";
    this.code = code;
    this.status = status;
  }
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

function databaseSource(kind: "exact" | "near_exact" | "similarity" | "topic"): HumanizeSource {
  return kind === "exact" ? "EXACT_TRAINING_MATCH" : "DATABASE_SIMILARITY_MATCH";
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const databaseHit = findDatabaseMatch(request.text);
  if (!databaseHit) {
    throw new HumanizationFailedError(
      "This draft is not in your training data. Paste a stored AI draft to get its paired human version.",
      "NO_TRAINING_MATCH",
      404,
    );
  }

  console.info("[humanize] [DATABASE_MATCH]", {
    row: databaseHit.index,
    kind: databaseHit.kind,
    score: databaseHit.score,
    rows: getTrainingRowCount(),
  });

  return {
    text: databaseHit.output,
    source: databaseSource(databaseHit.kind),
    retrieval: {
      band: databaseHit.kind === "exact" ? "exact" : "high",
      matches: [{ index: databaseHit.index, score: databaseHit.score }],
    },
  };
}
