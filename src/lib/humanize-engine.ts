import "server-only";

import {
  GeminiError,
  generateText,
  hasVertexEndpointEnv,
  isBaseGeminiFallbackEnabled,
  isVertexConfigured,
} from "@/lib/gemini";
import {
  ENTITY_MERGE_SYSTEM_INSTRUCTION,
  buildEditorSystemInstruction,
  buildEntityMergeUserMessage,
  buildLengthRepairInstruction,
  buildRepairSystemInstruction,
  buildStrongerRewriteInstruction,
  buildTunedSystemInstruction,
} from "@/lib/humanize-prompt";
import {
  assessMergeQuality,
  assessRewriteQuality,
  entitiesNeedMerge,
  isBlockingQualityFailure,
  lengthRatio,
  missingFactsForRetry,
  phraseCopyRatio,
  tryDeterministicEntityMerge,
  type QualityContext,
} from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
import {
  findDatabaseMatch,
  retrieveTrainingExamples,
  type SimilarityBand,
  type TrainingRetrieval,
} from "@/lib/training-retrieval";
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
  band: SimilarityBand;
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

function mergeGenerationOptions(template: string) {
  const words = countWords(template);
  return {
    temperature: 0,
    topP: 0.1,
    maxOutputTokens: Math.min(8192, Math.max(256, Math.ceil(words * 1.4) + 80)),
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

function qualityContext(retrieval: TrainingRetrieval | null): QualityContext | undefined {
  if (!retrieval || retrieval.examples.length === 0) return undefined;
  return {
    retrievedPairs: retrieval.examples.map((example) => ({
      input: example.input,
      output: example.output,
    })),
  };
}

function summarizeRetrieval(retrieval: TrainingRetrieval): HumanizeRetrievalSummary {
  return {
    band: retrieval.band,
    matches: retrieval.examples.map((example) => ({
      index: example.index,
      score: example.score,
    })),
  };
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

async function mergeEntitiesWithModel(userDraft: string, humanTemplate: string): Promise<string> {
  return generateText(buildEntityMergeUserMessage(userDraft, humanTemplate), {
    systemInstruction: ENTITY_MERGE_SYSTEM_INSTRUCTION,
    ...mergeGenerationOptions(humanTemplate),
  });
}

function modelAvailable(): boolean {
  return hasVertexEndpointEnv() || isVertexConfigured() || isBaseGeminiFallbackEnabled();
}

function scoreRewrite(input: string, candidate: string, context?: QualityContext): number {
  const quality = assessRewriteQuality(input, candidate, context);
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

function pickBetterRewrite(
  input: string,
  first: string,
  second: string,
  context?: QualityContext,
): string {
  return scoreRewrite(input, second, context) >= scoreRewrite(input, first, context) ? second : first;
}

function finalizeOutput(input: string, raw: string, context?: QualityContext): string {
  const quality = assessRewriteQuality(input, raw, context);
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
        band: "high" as const,
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
    const deterministic = tryDeterministicEntityMerge(
      request.text,
      databaseHit.input,
      databaseHit.output,
    );
    if (deterministic) {
      console.info("[humanize] [DATABASE_ENTITY_MERGE]", {
        row: databaseHit.index,
        score: databaseHit.score,
        rows: getTrainingRowCount(),
        mode: "deterministic",
      });
      return {
        text: deterministic,
        source: "DATABASE_ENTITY_MERGE",
        retrieval: databaseRetrieval,
      };
    }

    if (!modelAvailable()) {
      console.info("[humanize] [DATABASE_EXACT_MATCH]", {
        row: databaseHit.index,
        kind: databaseHit.kind,
        score: databaseHit.score,
        rows: getTrainingRowCount(),
        merge: "skipped_no_model",
      });
      return {
        text: databaseHit.output,
        source: "DATABASE_SIMILARITY_MATCH",
        retrieval: databaseRetrieval,
      };
    }

    try {
      console.info("[humanize] [DATABASE_ENTITY_MERGE]", {
        row: databaseHit.index,
        score: databaseHit.score,
        rows: getTrainingRowCount(),
        mode: "llm",
      });
      const merged = await mergeEntitiesWithModel(request.text, databaseHit.output);
      const mergeQuality = assessMergeQuality(request.text, databaseHit.output, merged);
      if (mergeQuality.ok) {
        return {
          text: mergeQuality.output,
          source: "DATABASE_ENTITY_MERGE",
          retrieval: databaseRetrieval,
        };
      }
      console.info("[humanize] entity merge quality failed; rewriting", {
        codes: mergeQuality.issues.map((issue) => issue.code),
      });
    } catch (error) {
      console.error("[humanize] entity merge failed; rewriting", {
        code: error instanceof GeminiError ? error.code : "MERGE_FAILED",
      });
    }
  }

  const retrieval = retrieveTrainingExamples(request.text);
  const context = qualityContext(retrieval);
  const retrievalSummary = summarizeRetrieval(retrieval);

  if (hasVertexEndpointEnv() || isVertexConfigured()) {
    try {
      console.info("[humanize] [MODEL_GENERATED]", {
        rows: getTrainingRowCount(),
        band: retrieval.band,
        matches: retrievalSummary.matches,
        sentExamples: retrieval.examples.length,
      });
      const first = await rewriteWithModel(request, {
        tuned: true,
        systemInstruction: buildTunedSystemInstruction(request, retrieval),
      });
      const firstQuality = assessRewriteQuality(request.text, first, context);
      if (firstQuality.ok) {
        return {
          text: firstQuality.output,
          source: "FINE_TUNED_MODEL",
          retrieval: retrievalSummary,
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
          ? buildLengthRepairInstruction(request, missing, retrieval)
          : copiedTooClosely
            ? buildStrongerRewriteInstruction(request, missing, retrieval)
            : buildRepairSystemInstruction(request, missing, retrieval),
      });
      const chosen = pickBetterRewrite(
        request.text,
        firstQuality.output || first,
        repaired,
        context,
      );
      return {
        text: finalizeOutput(request.text, chosen, context),
        source: "FINE_TUNED_MODEL",
        retrieval: retrievalSummary,
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
        text: finalizeOutput(request.text, text, context),
        source: "FINE_TUNED_MODEL",
        retrieval: retrievalSummary,
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
