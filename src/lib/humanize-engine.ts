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
  missingFactsForRetry,
  phraseCopyRatio,
  stripModelChrome,
} from "@/lib/humanize-quality";
import { getTrainingRowCount } from "@/lib/training-lookup";
import { findTopicMatch, type DatabaseTrainingMatch } from "@/lib/training-retrieval";
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

const REWRITE_TOP_P = 0.95;

/**
 * Unmatched drafts use the rewrite-trained Vertex endpoint after
 * `npm run bind:vertex` (OG REFINO rewrite, v3, or v2). Until
 * VERTEX_HUMAN_TEXT_MODEL=1, a publisher Gemini model rewrites with the same
 * instruction. The lookup-tuned OG REFINO endpoint must not see new drafts.
 */
function isHumanTextTunedReady(): boolean {
  return process.env.VERTEX_HUMAN_TEXT_MODEL?.trim() === "1";
}

function unmatchedRewriteBackend(): GenerateBackend {
  return isHumanTextTunedReady() ? "tuned" : "base";
}

function unmatchedRewriteTemperature(backend: GenerateBackend): number {
  return backend === "tuned" ? 0.55 : 0.62;
}

function rewriteGenerationOptions(temperature: number) {
  return {
    temperature,
    topP: REWRITE_TOP_P,
    maxOutputTokens: 8192,
  };
}

function wrapAsError(error: unknown): HumanizationFailedError {
  if (error instanceof HumanizationFailedError) return error;
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
    ...rewriteGenerationOptions(options.temperature),
    backend: options.backend,
    thinkingBudget: 0,
  });
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

function rewritePenalty(input: string, output: string): number {
  const inWords = countWords(input);
  const outWords = countWords(output);
  const tooShort = inWords >= 40 && outWords < inWords * 0.7;
  const tooLong = inWords >= 40 && outWords > inWords * 1.55;
  const copy = phraseCopyRatio(input, output);
  const quality = assessRewriteQuality(input, output);
  const blocking = quality.issues.some((issue) =>
    [
      "REFUSAL",
      "LEAK",
      "UNRELATED",
      "COPIED_RETRIEVED",
      "GENERIC",
      "MISSING_FACTS",
      "MISSING_NAMES",
    ].includes(issue.code),
  );
  const collapsed = quality.issues.some(
    (issue) => issue.code === "TOO_SHORT" || issue.code === "PARAGRAPH_DRIFT",
  );

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
  const backend = unmatchedRewriteBackend();
  const temperature = unmatchedRewriteTemperature(backend);
  const vertex = getVertexConfig();
  const systemInstruction = buildHumanRewriteInstruction({ text: request.text }, []);

  console.info("[humanize] [MODEL_GENERATED]", {
    rows: getTrainingRowCount(),
    backend,
    humanTextTuned: isHumanTextTunedReady(),
    model:
      backend === "tuned" && vertex
        ? redactModelName(vertex.model)
        : redactModelName("gemini-2.5-flash"),
    location: vertex?.location,
  });

  const outputRaw = await rewriteWithModel(request, {
    backend,
    temperature,
    systemInstruction,
  });
  let output = stripModelChrome(outputRaw);

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
  const droppedFacts = missingFactsForRetry(request.text, output);

  if (tooShort || copiedTooClosely || droppedFacts.length > 0) {
    console.info("[humanize] retrying once because the rewrite is truncated, copied, or missing facts", {
      tooShort,
      copiedTooClosely,
      droppedFacts,
      backend,
      inWords: inputWords,
      outWords: countWords(output),
    });

    const repairInstruction = tooShort
      ? `${systemInstruction}
The last version was ${countWords(output)} words. That is a summary and is not allowed.
Write the full rewrite of the user's draft, close to ${inputWords} words, with the same paragraph breaks.
Keep every name, date, and number. Do not switch topics. Do not add a title.`
      : droppedFacts.length > 0
        ? `${systemInstruction}
The last version dropped these details from the draft: ${droppedFacts.join("; ")}.
Put every one of them back. Rewrite the sentences around them. Do not delete informal opening lines.`
        : `${systemInstruction}
The last version copied the draft. Change the sentence openings. Keep every fact, name, number, and paragraph break.`;

    const repaired = stripModelChrome(
      await rewriteWithModel(request, {
        backend,
        temperature: Math.max(0.35, temperature - 0.12),
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
  const topicHit = findTopicMatch(request.text);
  if (topicHit) return resolveStoredHit(topicHit);

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
    throw wrapAsError(error);
  }
}
