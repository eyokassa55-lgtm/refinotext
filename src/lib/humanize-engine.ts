import "server-only";

import { getTrainingRowCount } from "@/lib/training-lookup";
import { findTopicMatch, type DatabaseTrainingMatch } from "@/lib/training-retrieval";
import type { HumanizeApiSource } from "@/lib/training-schema";

export type HumanizeRequest = {
  text: string;
  tone?: string;
  readability?: string;
  intensity?: number;
};

export type HumanizeSource =
  | "EXACT_TRAINING_MATCH"
  | "DATABASE_SIMILARITY_MATCH"
  | "TOPIC_TRAINING_MATCH"
  | "FINE_TUNED_MODEL";

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

function databaseRetrieval(hit: DatabaseTrainingMatch): HumanizeRetrievalSummary {
  return {
    band: "high",
    matches: [{ index: hit.index, score: hit.score }],
  };
}

/**
 * Return the stored human_text from the matched row. Never rewrite it.
 */
function resolveStoredHit(hit: DatabaseTrainingMatch): HumanizeResult {
  console.info("[humanize] [TOPIC_MATCH]", {
    row: hit.index,
    kind: hit.kind,
    score: hit.score,
    rows: getTrainingRowCount(),
  });
  return {
    text: hit.output,
    source: "TOPIC_TRAINING_MATCH",
    retrieval: databaseRetrieval(hit),
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const topicHit = findTopicMatch(request.text);
  if (topicHit) return resolveStoredHit(topicHit);

  throw new HumanizationFailedError(
    "No matching topic was found in the training set.",
    "NO_TRAINING_MATCH",
    404,
  );
}
