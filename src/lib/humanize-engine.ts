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
import { buildHumanRewriteInstruction } from "@/lib/humanize-prompt";
import {
  assessRewriteQuality,
  entitiesNeedMerge,
  phraseCopyRatio,
  stripModelChrome,
  tryDeterministicEntityMerge,
} from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
import {
  findDatabaseMatch,
  pickDistantStyleReferences,
  type DatabaseTrainingMatch,
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

const REWRITE_TOP_P = 0.95;

function rewriteGenerationOptions(request: HumanizeRequest, temperature: number) {
  const words = countWords(request.text);
  return {
    temperature,
    topP: REWRITE_TOP_P,
    maxOutputTokens: 8192,
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
  options: {
    systemInstruction: string;
    backend: GenerateBackend;
    temperature: number;
  },
): Promise<string> {
  return generateText(request.text, {
    systemInstruction: options.systemInstruction,
    ...rewriteGenerationOptions(request, options.temperature),
    backend: options.backend,
    thinkingBudget: 0,
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

function rewritePenalty(input: string, output: string): number {
  const inWords = countWords(input);
  const outWords = countWords(output);
  const tooShort = inWords >= 40 && outWords < inWords * 0.7;
  const tooLong = inWords >= 40 && outWords > inWords * 1.55;
  const copy = phraseCopyRatio(input, output);
  const quality = assessRewriteQuality(input, output);
  const blocking = quality.issues.some((issue) =>
    ["REFUSAL", "LEAK", "UNRELATED", "COPIED_RETRIEVED", "GENERIC"].includes(issue.code),
  );
  const collapsed = quality.issues.some((issue) => issue.code === "TOO_SHORT" || issue.code === "PARAGRAPH_DRIFT");

  let score = 0;
  if (!output.trim()) score += 100;
  if (blocking) score += 80;
  if (tooShort || collapsed) score += 50;
  if (tooLong) score += 8;
  if (copy >= 0.22) score += 18;
  score += copy * 12;
  if (inWords > 0) score += (Math.abs(outWords - inWords) / inWords) * 6;
  return score;
}

async function runModelHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const vertex = getVertexConfig();
  const demo = pickDistantStyleReferences(request.text, 1);
  const systemInstruction = buildHumanRewriteInstruction(request, demo);
  const lengthOnlyInstruction = buildHumanRewriteInstruction(request, []);

  console.info("[humanize] [MODEL_GENERATED]", {
    rows: getTrainingRowCount(),
    tone: request.tone ?? "standard",
    provider: vertex ? "vertex-base" : "gemini-api",
    backend: "base",
    model: redactModelName("gemini-2.5-flash"),
    location: vertex?.location,
    intensity: request.intensity ?? 75,
    styleRefs: demo.map((item) => item.index),
  });

  let output = "";
  try {
    output = extractTunedOutput(
      await rewriteWithModel(request, {
        backend: "base",
        temperature: 0.62,
        systemInstruction,
      }),
    );
  } catch (error) {
    console.error("[humanize] rewrite candidate failed", {
      code: error instanceof HumanizationFailedError ? error.code : "UNKNOWN",
    });
  }

  if (!output) {
    throw new HumanizationFailedError(
      "The writing service returned an empty response.",
      "EMPTY_RESPONSE",
      502,
    );
  }

  const inputWords = countWords(request.text);
  const tooShort = inputWords >= 40 && countWords(output) < inputWords * 0.7;
  const copiedTooClosely = phraseCopyRatio(request.text, output) >= 0.22;

  if (tooShort || copiedTooClosely) {
    console.info("[humanize] retrying once because the rewrite is truncated or copied", {
      tooShort,
      copiedTooClosely,
      backend: "base",
      inWords: inputWords,
      outWords: countWords(output),
    });

    const repairInstruction = tooShort
      ? `${lengthOnlyInstruction}
The last version was ${countWords(output)} words. That is a summary and is not allowed.
Write the full rewrite of the user's draft, close to ${inputWords} words, with the same paragraph breaks.
Do not switch topics. Do not add a title.`
      : `${lengthOnlyInstruction}
The last version copied the draft. Change the sentence openings. Keep every fact, name, number, and paragraph break.`;

    const repaired = extractTunedOutput(
      await rewriteWithModel(request, {
        backend: "base",
        temperature: 0.5,
        systemInstruction: repairInstruction,
      }),
    );
    if (repaired) {
      const preferRepair =
        (tooShort && countWords(repaired) > countWords(output)) ||
        rewritePenalty(request.text, repaired) < rewritePenalty(request.text, output);
      if (preferRepair) output = repaired;
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

  output = quality.output || output;

  if (inputWords >= 40 && countWords(output) < inputWords * 0.55) {
    throw new HumanizationFailedError(
      "The rewrite was too short. Please try again.",
      "TEXT_TOO_SHORT",
      502,
    );
  }

  return {
    text: output,
    source: "FINE_TUNED_MODEL",
    retrieval: null,
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  const databaseHit = findDatabaseMatch(request.text);
  if (databaseHit) {
    const resolved = resolveDatabaseHit(request, databaseHit);
    if (resolved) return resolved;
  }

  // OG REFINO is a lookup-tuned endpoint. New drafts must not go there.
  // Unmatched text is rewritten with a publisher Gemini model plus stored human_text as style.
  if (!isGeminiApiConfigured() && !hasVertexEndpointEnv() && !isVertexConfigured()) {
    console.error("[humanize] No Vertex credentials or Gemini API key is configured");
    throw new HumanizationFailedError(
      "The writing service is not configured. Please try again later.",
      "MISSING_API_KEY",
      503,
    );
  }

  try {
    return await runModelHumanization(request);
  } catch (error) {
    if (error instanceof HumanizationFailedError) throw error;
    throw wrapAsError(error);
  }
}
