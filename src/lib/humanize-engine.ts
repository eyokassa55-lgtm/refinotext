import "server-only";

import {
  GeminiError,
  generateText,
  getGeminiModel,
  getVertexConfig,
  hasVertexEndpointEnv,
  isGeminiApiConfigured,
  isVertexConfigured,
  redactModelName,
} from "@/lib/gemini";
import {
  buildStrongerRewriteInstruction,
  buildVertexSystemInstruction,
} from "@/lib/humanize-prompt";
import { assessRewriteQuality, phraseCopyRatio, stripModelChrome } from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
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

const TUNED_VERTEX_TEMPERATURE = 0;
const TUNED_VERTEX_TOP_P = 0.1;

function generationOptions(request: HumanizeRequest, tuned: boolean) {
  const intensity = request.intensity ?? 75;
  const words = countWords(request.text);

  if (tuned) {
    return {
      temperature: TUNED_VERTEX_TEMPERATURE,
      topP: TUNED_VERTEX_TOP_P,
      maxOutputTokens: Math.min(8192, Math.max(256, Math.ceil(words * 1.55) + 120)),
    };
  }

  const temperature = 0.38 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.32;
  return {
    temperature: Math.min(0.72, temperature),
    topP: 0.95,
    maxOutputTokens: Math.min(8192, Math.max(256, Math.ceil(words * 2.2) + 160)),
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
  options: { systemInstruction?: string; tuned: boolean },
): Promise<string> {
  return generateText(request.text, {
    ...(options.systemInstruction
      ? { systemInstruction: options.systemInstruction }
      : {}),
    ...generationOptions(request, options.tuned),
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

async function runModelHumanization(
  request: HumanizeRequest,
  options: { provider: "vertex" | "gemini-api"; tuned: boolean },
): Promise<HumanizeResult> {
  const vertex = getVertexConfig();
  const modelName =
    options.provider === "vertex"
      ? redactModelName(vertex?.model ?? "TUNED_MODEL_ENDPOINT")
      : redactModelName(getGeminiModel());

  console.info("[humanize] [MODEL_GENERATED]", {
    rows: getTrainingRowCount(),
    tone: request.tone ?? "standard",
    provider: options.provider,
    model: modelName,
    location: options.provider === "vertex" ? vertex?.location : undefined,
    baseGemini: options.provider === "gemini-api",
  });

  const raw = await rewriteWithModel(request, {
    tuned: options.tuned,
    systemInstruction: buildVertexSystemInstruction(request),
  });
  let output = extractTunedOutput(raw);
  if (!output) {
    throw new HumanizationFailedError(
      "The writing service returned an empty response.",
      "EMPTY_RESPONSE",
      502,
    );
  }

  const copiedTooClosely = phraseCopyRatio(request.text, output) >= 0.22;
  if (copiedTooClosely) {
    console.info("[humanize] retrying once because the model copied the draft");
    const repaired = extractTunedOutput(
      await rewriteWithModel(request, {
        tuned: options.tuned,
        systemInstruction: buildStrongerRewriteInstruction(request, []),
      }),
    );
    if (repaired && phraseCopyRatio(request.text, repaired) < phraseCopyRatio(request.text, output)) {
      output = repaired;
    }
  }

  const quality = assessRewriteQuality(request.text, output);
  if (quality.issues.some((issue) => issue.code === "REFUSAL" || issue.code === "LEAK")) {
    console.error("[humanize] model returned an unusable response", {
      codes: quality.issues.map((issue) => issue.code),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  if (options.provider === "gemini-api") {
    output = finalizeFallbackOutput(request.text, output);
  }

  return {
    text: output,
    source: "FINE_TUNED_MODEL",
    retrieval: null,
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  if (hasVertexEndpointEnv() || isVertexConfigured()) {
    try {
      return await runModelHumanization(request, { provider: "vertex", tuned: true });
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  if (isGeminiApiConfigured()) {
    try {
      return await runModelHumanization(request, { provider: "gemini-api", tuned: false });
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  console.error("[humanize] No Vertex endpoint or Gemini API key is configured");
  throw new HumanizationFailedError(
    "The writing service is not configured. Please try again later.",
    "MISSING_API_KEY",
    503,
  );
}
