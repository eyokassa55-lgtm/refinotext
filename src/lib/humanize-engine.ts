import "server-only";

import {
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
import {
  applyInputTitle,
  formatEssayParagraphs,
  extractUserTitle,
  fitWikipediaOutputToInput,
  formatWikipediaEditorText,
} from "@/lib/humanize-output";
import type { DatabaseTrainingMatch } from "@/lib/training-retrieval";
import {
  findWikipediaLiveMatch,
  WIKIPEDIA_EDITOR_MAX_CHARS,
  WIKIPEDIA_EDITOR_MAX_PARAGRAPHS,
} from "@/lib/wikipedia-corpus";
import { pickWikipediaStyleExample } from "@/lib/wikipedia-style-examples";
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
const RETRY_SHORT_RATIO = 0.85;
const REJECT_SHORT_RATIO = 0.8;
const MAX_REWRITE_REPAIRS = 2;

/**
 * Prefer live Wikipedia prose (same style as wikipedia_training_pairs outputs).
 * Fall back to TOPN1 with a Wikipedia-training style example in the prompt.
 */
function isHumanTextTunedReady(): boolean {
  return process.env.VERTEX_HUMAN_TEXT_MODEL?.trim() === "1";
}

function canRewriteWithModel(): boolean {
  return hasVertexEndpointEnv() || isVertexConfigured() || isGeminiApiConfigured();
}

function unmatchedRewriteBackend(): GenerateBackend {
  if (hasVertexEndpointEnv() || isHumanTextTunedReady()) return "tuned";
  return "base";
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

function resolveStoredHit(hit: DatabaseTrainingMatch): HumanizeResult {
  console.info("[humanize] [TOPIC_MATCH]", {
    row: hit.index,
    kind: hit.kind,
    score: hit.score,
    source: hit.index >= 90_000 ? "wikipedia-live" : "wikipedia-corpus",
  });
  return {
    text: formatEssayParagraphs(hit.output),
    source: "TOPIC_TRAINING_MATCH",
    retrieval: databaseRetrieval(hit),
  };
}

function rewritePenalty(input: string, output: string): number {
  const inWords = countWords(input);
  const outWords = countWords(output);
  const tooShort = inWords >= 40 && outWords < inWords * RETRY_SHORT_RATIO;
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
  return (
    (tooShort ? 4 : 0) +
    (tooLong ? 2 : 0) +
    (copy >= 0.22 ? 5 : copy >= 0.14 ? 2 : 0) +
    (blocking ? 6 : 0) +
    (collapsed ? 3 : 0) +
    quality.issues.length
  );
}

async function runModelHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  if (!canRewriteWithModel()) {
    throw new HumanizationFailedError(
      "The rewrite model is not configured.",
      "MISSING_VERTEX_CONFIG",
      503,
    );
  }

  const style = pickWikipediaStyleExample(request.text);
  const systemInstruction = buildHumanRewriteInstruction(
    { text: request.text, tone: request.tone, readability: request.readability, intensity: request.intensity },
    style ? [{ input: style.input, output: style.output }] : [],
  );

  const backend = unmatchedRewriteBackend();
  const temperature = unmatchedRewriteTemperature(backend);
  const vertex = getVertexConfig();
  console.info("[humanize] [MODEL]", {
    backend,
    model:
      backend === "tuned" && vertex
        ? redactModelName(vertex.model)
        : redactModelName("gemini-2.5-flash"),
    styleExample: Boolean(style),
  });

  let output = stripModelChrome(
    await rewriteWithModel(request, { backend, temperature, systemInstruction }),
  );
  if (!output) {
    throw new HumanizationFailedError("Empty model response.", "EMPTY_RESPONSE", 502);
  }

  const inputWords = countWords(request.text);
  const isShort = (text: string) => inputWords >= 40 && countWords(text) < inputWords * RETRY_SHORT_RATIO;
  let tooShort = isShort(output);
  let copiedTooClosely = phraseCopyRatio(request.text, output) >= 0.22;
  let droppedFacts = missingFactsForRetry(request.text, output);

  for (let attempt = 0; attempt < MAX_REWRITE_REPAIRS; attempt += 1) {
    if (!tooShort && !copiedTooClosely && droppedFacts.length === 0) break;

    console.info("[humanize] retrying because the rewrite is truncated, copied, or missing facts", {
      attempt: attempt + 1,
      tooShort,
      copiedTooClosely,
      droppedFacts,
      backend,
      inWords: inputWords,
      outWords: countWords(output),
    });

    const repairInstruction = tooShort
      ? `${systemInstruction}
The last version was ${countWords(output)} words for a ${inputWords}-word draft. That is a summary and is not allowed.
Write the full rewrite, about ${inputWords} words, with the same paragraph breaks.
Keep every name, date, number, and claim. Do not switch topics. Do not add a title.`
      : droppedFacts.length > 0
        ? `${systemInstruction}
The last version dropped these details from the draft: ${droppedFacts.join("; ")}.
Put every one of them back. Rewrite the sentences around them. Do not delete informal opening lines.
Keep about ${inputWords} words.`
        : `${systemInstruction}
The last version copied the draft. Change the sentence openings. Keep every fact, name, number, paragraph break, and about ${inputWords} words.`;

    const repaired = stripModelChrome(
      await rewriteWithModel(request, {
        backend,
        temperature: Math.max(0.28, temperature - 0.08 * (attempt + 1)),
        systemInstruction: repairInstruction,
      }),
    );
    if (!repaired) break;

    const preferRepair =
      (tooShort && countWords(repaired) > countWords(output)) ||
      rewritePenalty(request.text, repaired) < rewritePenalty(request.text, output);
    if (!preferRepair) break;

    output = repaired;
    tooShort = isShort(output);
    copiedTooClosely = phraseCopyRatio(request.text, output) >= 0.22;
    droppedFacts = missingFactsForRetry(request.text, output);
  }

  const quality = assessRewriteQuality(request.text, output);
  if (
    quality.issues.some(
      (issue) => issue.code === "REFUSAL" || issue.code === "LEAK" || issue.code === "UNRELATED",
    )
  ) {
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

  if (inputWords >= 40 && countWords(output) < inputWords * REJECT_SHORT_RATIO) {
    throw new HumanizationFailedError(
      "The rewrite was too short. Please try again.",
      "TEXT_TOO_SHORT",
      502,
    );
  }

  const titled = extractUserTitle(request.text);
  if (titled) {
    let body = output.replace(/^#\s+[^\n]+\n*/, "").trim();
    const firstLine = body.split(/\n/)[0]?.trim() ?? "";
    if (firstLine.toLowerCase() === titled.toLowerCase()) {
      body = body.slice(firstLine.length).replace(/^\n+/, "").trim();
    }
    output = `${titled}\n\n${body}`;
  }

  output = formatEssayParagraphs(output);

  return {
    text: output.trim(),
    source: "FINE_TUNED_MODEL",
    retrieval: null,
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  // Primary: live Wikipedia prose (same human encyclopedia style as training-pair outputs).
  const wikipediaHit = await findWikipediaLiveMatch(request.text);
  if (wikipediaHit) {
    const inputWords = countWords(request.text);
    const topic = wikipediaHit.topic?.trim() || extractUserTitle(request.text) || "Article";
    const sizedFromRaw = wikipediaHit.rawExtract
      ? formatWikipediaEditorText(
          topic,
          wikipediaHit.rawExtract,
          WIKIPEDIA_EDITOR_MAX_CHARS,
          WIKIPEDIA_EDITOR_MAX_PARAGRAPHS,
          inputWords,
        )
      : wikipediaHit.output;

    let output = fitWikipediaOutputToInput(
      applyInputTitle(sizedFromRaw, request.text),
      request.text,
    );
    output = formatEssayParagraphs(output);

    const outputWords = countWords(output);
    const endsComplete = /[.!?]["”']?\s*$/.test(output.trim());

    if (
      inputWords >= 80 &&
      (!endsComplete || outputWords < inputWords * 0.9) &&
      canRewriteWithModel()
    ) {
      console.info("[humanize] Wikipedia output too short or incomplete; using Vertex with Wikipedia style example", {
        inputWords,
        outputWords,
        endsComplete,
      });
      return runModelHumanization(request);
    }

    return resolveStoredHit({
      ...wikipediaHit,
      output,
    });
  }

  // Fallback: TOPN1 with a BEFORE/AFTER example from wikipedia_training_pairs outputs.
  if (canRewriteWithModel()) {
    console.info("[humanize] no Wikipedia topic match; tuned model + Wikipedia style example");
    return runModelHumanization(request);
  }

  throw new HumanizationFailedError(
    "No Wikipedia article matches this topic, and the rewrite model is not configured.",
    "NO_WIKIPEDIA_MATCH",
    422,
  );
}
