import "server-only";

import { GrubbyError, humanizeWithGrubby, isGrubbyConfigured } from "@/lib/grubby";
import { stripModelChrome } from "@/lib/humanize-quality";
import type { HumanizeApiSource } from "@/lib/training-schema";
import { countWords } from "@/lib/words";

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

function wrapAsError(error: unknown): HumanizationFailedError {
  if (error instanceof GrubbyError) {
    return new HumanizationFailedError(error.message, error.code, error.status);
  }

  return new HumanizationFailedError(
    "Humanization failed. Please try again.",
    "HUMANIZATION_FAILED",
  );
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  if (!isGrubbyConfigured()) {
    throw new HumanizationFailedError(
      "The writing service is not configured. Please try again later.",
      "MISSING_GRUBBY_CONFIG",
      503,
    );
  }

  try {
    console.info("[humanize] [MODEL_GENERATED]", {
      provider: "grubby",
      words: countWords(request.text),
      tone: request.tone ?? "standard",
    });
    const output = stripModelChrome(await humanizeWithGrubby(request.text));
    if (!output) {
      throw new HumanizationFailedError(
        "The writing service returned an empty response.",
        "EMPTY_RESPONSE",
        502,
      );
    }
    return {
      text: output,
      source: "FINE_TUNED_MODEL",
      retrieval: null,
    };
  } catch (error) {
    if (error instanceof HumanizationFailedError) throw error;
    throw wrapAsError(error);
  }
}
