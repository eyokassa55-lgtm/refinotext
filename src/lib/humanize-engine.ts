import "server-only";

import {
  GeminiError,
  generateText,
  hasVertexEndpointEnv,
  isBaseGeminiFallbackEnabled,
  isVertexConfigured,
} from "@/lib/gemini";
import {
  buildEditorSystemInstruction,
  buildLengthRepairInstruction,
  buildRepairSystemInstruction,
  buildStrongerRewriteInstruction,
  buildTunedSystemInstruction,
} from "@/lib/humanize-prompt";
import {
  assessRewriteQuality,
  entitiesNeedMerge,
  isBlockingQualityFailure,
  lengthRatio,
  missingFactsForRetry,
  phraseCopyRatio,
  tryDeterministicEntityMerge,
} from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
import { findDatabaseMatch, peekClosestTrainingScore } from "@/lib/training-retrieval";
import type { HumanizeApiSource } from "@/lib/training-schema";
import { countWords } from "@/lib/words";

export type HumanizeRequest = {
  text: string;
  tone?: string;
  readability?: string;
  intensity?: number;
};

export type HumanizeSource =
  | "EXACT_TRAINING_MATCH"
  | "DATABASE_SIMILARITY_MATCH"
  | "DATABASE_ENTITY_MERGE"
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

function generationOptions(request: HumanizeRequest, tuned: boolean, extraTemperature = 0) {
  const intensity = request.intensity ?? 75;
  const temperature = tuned
    ? 0.32 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.22
    : 0.38 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.32;
  const words = countWords(request.text);
  return {
    temperature: Math.min(0.72, temperature + extraTemperature),
    topP: tuned ? 0.9 : 0.95,
    maxOutputTokens: Math.min(8192, Math.max(256, Math.ceil(words * (tuned ? 1.55 : 2.2)) + (tuned ? 120 : 160))),
  };
}

function wrapAsError(error: unknown): HumanizationFailedError {
  if (error instanceof GeminiError) {
    return new HumanizationFailedError(error.message, error.code, error.status);
  }

  return new HumanizationFailedError(
    "Humanization failed. Your credits were refunded.",
  );
}

async function rewriteWithModel(
  request: HumanizeRequest,
  options: { systemInstruction?: string; tuned: boolean; extraTemperature?: number },
): Promise<string> {
  return generateText(request.text, {
    ...(options.systemInstruction
      ? { systemInstruction: options.systemInstruction }
      : {}),
    ...generationOptions(request, options.tuned, options.extraTemperature),
  });
}

function scoreRewrite(input: string, candidate: string): number {
  const quality = assessRewriteQuality(input, candidate);
  if (!quality.output || isBlockingQualityFailure(quality)) return -100;

  let score = 10;
  const codes = new Set(quality.issues.map((issue) => issue.code));
  if (codes.has("TOO_SHORT")) score -= 20;
  if (codes.has("TOO_LONG")) score -= 16;
  if (codes.has("TOO_SIMILAR")) score -= 14;
  if (codes.has("TEMPLATE_VOICE")) score -= 12;
  if (codes.has("PARAGRAPH_DRIFT")) score -= 10;
  if (codes.has("RETRIEVED_FACTS")) score -= 12;
  if (codes.has("COPIED_RETRIEVED")) score -= 20;
  if ([...codes].some((code) => code.startsWith("MISSING"))) score -= 12;
  score -= Math.abs(1 - lengthRatio(input, quality.output)) * 12;
  score -= phraseCopyRatio(input, quality.output) * 10;
  return score;
}

function pickBetterRewrite(input: string, first: string, second: string): string {
  return scoreRewrite(input, second) >= scoreRewrite(input, first) ? second : first;
}

function finalizeOutput(input: string, raw: string): string {
  const quality = assessRewriteQuality(input, raw);
  if (quality.ok) return quality.output;

  if (isBlockingQualityFailure(quality) || !quality.output) {
    console.error("[humanize] quality check failed", {
      codes: quality.issues.map((issue) => issue.code),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  if (quality.issues.some((issue) => issue.code === "TOO_SHORT" || issue.code === "MISSING_FACTS" || issue.code === "MISSING_NAMES")) {
    console.error("[humanize] quality check failed", {
      codes: quality.issues.map((issue) => issue.code),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  return quality.output;
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const databaseHit = findDatabaseMatch(request.text);
  const databaseRetrieval = databaseHit
    ? {
        band: databaseHit.kind === "exact" ? ("exact" as const) : ("high" as const),
        matches: [{ index: databaseHit.index, score: databaseHit.score }],
      }
    : null;

  const needsEntityMerge =
    databaseHit?.kind === "similarity" && entitiesNeedMerge(request.text, databaseHit.input);

  if (databaseHit && !needsEntityMerge) {
    console.info("[humanize] [DATABASE_EXACT_MATCH]", {
      row: databaseHit.index,
      kind: databaseHit.kind,
      score: databaseHit.score,
      rows: getTrainingRowCount(),
    });
    return {
      text: databaseHit.output,
      source: databaseHit.kind === "exact" ? "EXACT_TRAINING_MATCH" : "DATABASE_SIMILARITY_MATCH",
      retrieval: databaseRetrieval,
    };
  }

  if (databaseHit && needsEntityMerge) {
    const merged = tryDeterministicEntityMerge(
      request.text,
      databaseHit.input,
      databaseHit.output,
    );
    if (merged) {
      console.info("[humanize] [DATABASE_ENTITY_MERGE]", {
        row: databaseHit.index,
        score: databaseHit.score,
        rows: getTrainingRowCount(),
        mode: "deterministic",
      });
      return {
        text: merged,
        source: "DATABASE_ENTITY_MERGE",
        retrieval: databaseRetrieval,
      };
    }
    console.info("[humanize] entity merge skipped; rewriting user draft", {
      row: databaseHit.index,
      score: databaseHit.score,
    });
  }

  const closest = peekClosestTrainingScore(request.text);
  const modelRetrieval = closest
    ? { band: "high" as const, matches: [{ index: closest.index, score: closest.score }] }
    : null;

  if (hasVertexEndpointEnv() || isVertexConfigured()) {
    try {
      console.info("[humanize] [MODEL_GENERATED]", {
        rows: getTrainingRowCount(),
        tone: request.tone ?? "standard",
        closest: closest ?? undefined,
      });
      const first = await rewriteWithModel(request, {
        tuned: true,
        systemInstruction: buildTunedSystemInstruction(request),
      });
      const firstQuality = assessRewriteQuality(request.text, first);
      if (firstQuality.ok) {
        return {
          text: firstQuality.output,
          source: "FINE_TUNED_MODEL",
          retrieval: modelRetrieval,
        };
      }

      console.info("[humanize] retrying once after quality check", {
        codes: firstQuality.issues.map((issue) => issue.code),
      });

      const missing = missingFactsForRetry(request.text, firstQuality.output || first);
      const codes = new Set(firstQuality.issues.map((issue) => issue.code));
      const copiedTooClosely =
        codes.has("TOO_SIMILAR") ||
        codes.has("TEMPLATE_VOICE") ||
        codes.has("COPIED_RETRIEVED") ||
        codes.has("RETRIEVED_FACTS");
      const expandedTooMuch = codes.has("TOO_LONG") || codes.has("PARAGRAPH_DRIFT");
      const repaired = await rewriteWithModel(request, {
        tuned: true,
        extraTemperature: copiedTooClosely ? 0.08 : 0,
        systemInstruction: expandedTooMuch
          ? buildLengthRepairInstruction(request, missing)
          : copiedTooClosely
            ? buildStrongerRewriteInstruction(request, missing)
            : buildRepairSystemInstruction(request, missing),
      });
      const chosen = pickBetterRewrite(
        request.text,
        firstQuality.output || first,
        repaired,
      );
      return {
        text: finalizeOutput(request.text, chosen),
        source: "FINE_TUNED_MODEL",
        retrieval: modelRetrieval,
      };
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  if (isBaseGeminiFallbackEnabled()) {
    try {
      const text = await rewriteWithModel(request, {
        tuned: false,
        systemInstruction: buildEditorSystemInstruction(request),
      });
      return {
        text: finalizeOutput(request.text, text),
        source: "FINE_TUNED_MODEL",
        retrieval: modelRetrieval,
      };
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  console.error(
    "[humanize] Vertex AI tuned endpoint is not configured; refusing base Gemini",
  );
  throw new HumanizationFailedError(
    "The writing service is not configured. Please try again later.",
    "MISSING_VERTEX_CONFIG",
    503,
  );
}
