import "server-only";

import {
  GeminiError,
  generateText,
  getVertexConfig,
  hasVertexEndpointEnv,
  isGeminiApiConfigured,
  isVertexConfigured,
  redactModelName,
  type GenerateBackend,
} from "@/lib/gemini";
import {
  buildAntiTemplateRewriteInstruction,
  buildStrongerRewriteInstruction,
  buildStyleGuidedRewriteInstruction,
  buildVertexSystemInstruction,
} from "@/lib/humanize-prompt";
import {
  assessRewriteQuality,
  entitiesNeedMerge,
  phraseCopyRatio,
  stripModelChrome,
  tryDeterministicEntityMerge,
} from "@/lib/humanize-quality";
import {
  findBannedAiPhrases,
  isTemplateLikeOutput,
  rewriteArtificialityScore,
} from "@/lib/humanize-voice";
import { getTrainingRowCount } from "@/lib/training-lookup";
import {
  findDatabaseMatch,
  retrieveTrainingExamples,
  type DatabaseTrainingMatch,
  type RetrievedTrainingExample,
} from "@/lib/training-retrieval";
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

const TUNED_VERTEX_TEMP_MIN = 0.15;
const TUNED_VERTEX_TEMP_MAX = 0.55;
const TUNED_VERTEX_TOP_P_MIN = 0.75;
const TUNED_VERTEX_TOP_P_MAX = 0.92;

function tunedVertexGenerationOptions(intensity?: number) {
  const clamped = Math.min(100, Math.max(0, intensity ?? 75));
  const ratio = clamped / 100;
  return {
    temperature: TUNED_VERTEX_TEMP_MIN + ratio * (TUNED_VERTEX_TEMP_MAX - TUNED_VERTEX_TEMP_MIN),
    topP: TUNED_VERTEX_TOP_P_MIN + ratio * (TUNED_VERTEX_TOP_P_MAX - TUNED_VERTEX_TOP_P_MIN),
  };
}

function generationOptions(request: HumanizeRequest, tuned: boolean) {
  const intensity = request.intensity ?? 75;
  const words = countWords(request.text);

  if (tuned) {
    return {
      ...tunedVertexGenerationOptions(intensity),
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
  options: { systemInstruction?: string; tuned: boolean; backend: GenerateBackend },
): Promise<string> {
  return generateText(request.text, {
    ...(options.systemInstruction
      ? { systemInstruction: options.systemInstruction }
      : {}),
    ...generationOptions(request, options.tuned),
    backend: options.backend,
  });
}

function extractTunedOutput(raw: string): string {
  return stripModelChrome(raw);
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

function databaseSource(kind: DatabaseTrainingMatch["kind"]): HumanizeSource {
  return kind === "exact" ? "EXACT_TRAINING_MATCH" : "DATABASE_SIMILARITY_MATCH";
}

function databaseRetrieval(hit: DatabaseTrainingMatch): HumanizeRetrievalSummary {
  return {
    band: hit.kind === "exact" ? "exact" : "high",
    matches: [{ index: hit.index, score: hit.score }],
  };
}

function resolveDatabaseHit(request: HumanizeRequest, hit: DatabaseTrainingMatch): HumanizeResult | null {
  const retrieval = databaseRetrieval(hit);
  const needsEntityMerge =
    hit.kind === "similarity" && entitiesNeedMerge(request.text, hit.input);

  if (needsEntityMerge) {
    const merged = tryDeterministicEntityMerge(request.text, hit.input, hit.output);
    if (merged) {
      console.info("[humanize] [DATABASE_ENTITY_MERGE]", {
        row: hit.index,
        kind: hit.kind,
        score: hit.score,
        rows: getTrainingRowCount(),
        mode: "deterministic",
      });
      return {
        text: merged,
        source: "DATABASE_SIMILARITY_MATCH",
        retrieval,
      };
    }
    return null;
  }

  console.info("[humanize] [DATABASE_MATCH]", {
    row: hit.index,
    kind: hit.kind,
    score: hit.score,
    rows: getTrainingRowCount(),
  });
  return {
    text: hit.output,
    source: databaseSource(hit.kind),
    retrieval,
  };
}

async function runModelHumanization(
  request: HumanizeRequest,
  options: {
    backend: GenerateBackend;
    styleExamples?: RetrievedTrainingExample[];
  },
): Promise<HumanizeResult> {
  const vertex = getVertexConfig();
  const providerLabel = options.backend === "tuned" ? "vertex" : "base";
  const modelName =
    options.backend === "tuned"
      ? redactModelName(vertex?.model ?? "TUNED_MODEL_ENDPOINT")
      : redactModelName("gemini-2.5-flash");

  console.info("[humanize] [MODEL_GENERATED]", {
    rows: getTrainingRowCount(),
    tone: request.tone ?? "standard",
    provider: providerLabel,
    backend: options.backend,
    model: modelName,
    location: vertex?.location,
    styleExamples: options.styleExamples?.map((example) => example.index) ?? [],
    intensity: request.intensity ?? 75,
    ...(options.backend === "tuned" ? tunedVertexGenerationOptions(request.intensity) : {}),
  });

  const systemInstruction = options.styleExamples?.length
    ? buildStyleGuidedRewriteInstruction(request, options.styleExamples)
    : buildVertexSystemInstruction(request);

  const raw = await rewriteWithModel(request, {
    tuned: options.backend === "tuned",
    backend: options.backend,
    systemInstruction,
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
  const bannedPhrases = findBannedAiPhrases(output);
  const templateLike = isTemplateLikeOutput(output, request.text);
  const needsRetry = copiedTooClosely || bannedPhrases.length > 0 || templateLike;

  if (needsRetry) {
    console.info("[humanize] retrying once because the rewrite still looks template-like", {
      copiedTooClosely,
      bannedPhrases,
      templateLike,
      backend: options.backend,
    });
    const instruction = templateLike || bannedPhrases.length > 0
      ? buildAntiTemplateRewriteInstruction(request, {
          bannedPhrases,
          templateLike,
          copied: copiedTooClosely,
        })
      : buildStrongerRewriteInstruction(request, []);

    const repaired = extractTunedOutput(
      await rewriteWithModel(request, {
        tuned: options.backend === "tuned",
        backend: options.backend,
        systemInstruction: instruction,
      }),
    );

    if (repaired) {
      const currentScore =
        rewriteArtificialityScore(output, request.text) +
        phraseCopyRatio(request.text, output);
      const repairedScore =
        rewriteArtificialityScore(repaired, request.text) +
        phraseCopyRatio(request.text, repaired);
      if (repairedScore < currentScore) {
        output = repaired;
      }
    }
  }

  const quality = assessRewriteQuality(request.text, output, {
    retrievedPairs: options.styleExamples,
  });
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

  if (quality.issues.some((issue) => issue.code === "COPIED_RETRIEVED" || issue.code === "UNRELATED")) {
    console.info("[humanize] style reference leaked or drifted; keeping source-faithful rewrite");
  }

  return {
    text: quality.output || output,
    source: "FINE_TUNED_MODEL",
    retrieval: options.styleExamples?.length
      ? {
          band: "high",
          matches: options.styleExamples.slice(0, 3).map((example) => ({
            index: example.index,
            score: example.score,
          })),
        }
      : null,
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const databaseHit = findDatabaseMatch(request.text);
  if (databaseHit) {
    const resolved = resolveDatabaseHit(request, databaseHit);
    if (resolved) return resolved;
  }

  const styleExamples = retrieveTrainingExamples(request.text, 3).examples;

  if (hasVertexEndpointEnv() || isVertexConfigured() || isGeminiApiConfigured()) {
    try {
      return await runModelHumanization(request, { backend: "base", styleExamples });
    } catch (error) {
      if (error instanceof HumanizationFailedError && error.code === "QUALITY_CHECK_FAILED") {
        throw error;
      }
      console.error("[humanize] base model failed", {
        code: error instanceof HumanizationFailedError ? error.code : "ERROR",
      });
      if (hasVertexEndpointEnv() || isVertexConfigured()) {
        try {
          return await runModelHumanization(request, { backend: "tuned", styleExamples });
        } catch (tunedError) {
          if (tunedError instanceof HumanizationFailedError) throw tunedError;
          throw wrapAsError(tunedError);
        }
      }
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
