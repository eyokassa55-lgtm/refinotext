import "server-only";

import {
  GeminiError,
  generateText,
  getVertexConfig,
  hasVertexEndpointEnv,
  isBaseGeminiFallbackEnabled,
  isVertexConfigured,
  redactModelName,
} from "@/lib/gemini";
import {
  buildEditorSystemInstruction,
  buildStrongerRewriteInstruction,
  buildTunedSystemInstruction,
} from "@/lib/humanize-prompt";
import { assessRewriteQuality, phraseCopyRatio, stripModelChrome } from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
import { findDatabaseMatch } from "@/lib/training-retrieval";
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
    "Humanization failed. Please try again.",
    "HUMANIZATION_FAILED",
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

function extractTunedOutput(raw: string): string {
  return stripModelChrome(raw);
}

function finalizeFallbackOutput(input: string, raw: string): string {
  const quality = assessRewriteQuality(input, raw);
  if (quality.output) return quality.output;
  const cleaned = extractTunedOutput(raw);
  if (!cleaned) {
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }
  return cleaned;
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

function databaseSource(kind: "exact" | "near_exact" | "similarity" | "topic"): HumanizeSource {
  return kind === "exact" ? "EXACT_TRAINING_MATCH" : "DATABASE_SIMILARITY_MATCH";
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const databaseHit = findDatabaseMatch(request.text);
  if (databaseHit) {
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

  const vertex = getVertexConfig();
  if (hasVertexEndpointEnv() || isVertexConfigured()) {
    try {
      console.info("[humanize] [MODEL_GENERATED]", {
        rows: getTrainingRowCount(),
        tone: request.tone ?? "standard",
        provider: "vertex",
        model: redactModelName(vertex?.model ?? "TUNED_MODEL_ENDPOINT"),
        location: vertex?.location,
        baseGemini: false,
      });
      const raw = await rewriteWithModel(request, {
        tuned: true,
        systemInstruction: buildTunedSystemInstruction(request),
      });
      let output = extractTunedOutput(raw);
      if (!output) {
        throw new HumanizationFailedError(
          "The writing service returned an empty response.",
          "EMPTY_RESPONSE",
          502,
        );
      }

      const copiedTooClosely = phraseCopyRatio(request.text, output) >= 0.32;
      if (copiedTooClosely) {
        console.info("[humanize] retrying once because the tuned model copied the draft");
        const repaired = extractTunedOutput(
          await rewriteWithModel(request, {
            tuned: true,
            extraTemperature: 0.1,
            systemInstruction: buildStrongerRewriteInstruction(request, []),
          }),
        );
        if (repaired && phraseCopyRatio(request.text, repaired) < phraseCopyRatio(request.text, output)) {
          output = repaired;
        }
      }

      const quality = assessRewriteQuality(request.text, output);
      if (quality.issues.some((issue) => issue.code === "REFUSAL" || issue.code === "LEAK")) {
        console.error("[humanize] tuned model returned an unusable response", {
          codes: quality.issues.map((issue) => issue.code),
        });
        throw new HumanizationFailedError(
          "Humanization failed. Please try again.",
          "QUALITY_CHECK_FAILED",
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

  if (isBaseGeminiFallbackEnabled()) {
    try {
      const text = await rewriteWithModel(request, {
        tuned: false,
        systemInstruction: buildEditorSystemInstruction(request),
      });
      return {
        text: finalizeFallbackOutput(request.text, text),
        source: "FINE_TUNED_MODEL",
        retrieval: null,
      };
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  console.error("[humanize] Vertex AI tuned endpoint is not configured; refusing base Gemini");
  throw new HumanizationFailedError(
    "The writing service is not configured. Please try again later.",
    "MISSING_VERTEX_CONFIG",
    503,
  );
}
