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
import { findDatabaseMatch, findTopicMatch } from "@/lib/training-retrieval";
import {
  findWikipediaLiveMatch,
  WIKIPEDIA_EDITOR_MAX_CHARS,
  WIKIPEDIA_EDITOR_MAX_PARAGRAPHS,
} from "@/lib/wikipedia-corpus";
import { pickWikipediaStyleExamples } from "@/lib/wikipedia-style-examples";
import { scrubAiEssayMarks } from "@/lib/humanize-voice";
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
const MAX_REWRITE_REPAIRS = 3;
/** Soft threshold: retry rewrite when phrase overlap is this high. */
const COPY_RETRY_RATIO = 0.16;
/** Hard reject when still this similar after repairs. */
const COPY_REJECT_RATIO = 0.28;

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
  // Unseen drafts: prefer base Gemini + Wikipedia AFTER examples.
  // The tuned endpoint too often echoes the draft or keeps chatbot cadence that detectors mark AI.
  if (isGeminiApiConfigured()) return "base";
  if (hasVertexEndpointEnv() || isHumanTextTunedReady()) return "tuned";
  return "base";
}

function unmatchedRewriteTemperature(backend: GenerateBackend, intensity?: number): number {
  const boost = (intensity ?? 75) >= 85 ? 0.12 : 0;
  return (backend === "tuned" ? 0.72 : 0.78) + boost;
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
    (copy >= COPY_REJECT_RATIO ? 8 : copy >= COPY_RETRY_RATIO ? 5 : copy >= 0.1 ? 2 : 0) +
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

  const styleExamples = pickWikipediaStyleExamples(request.text, 2);
  const systemInstruction = buildHumanRewriteInstruction(
    {
      text: request.text,
      tone: request.tone,
      readability: request.readability,
      intensity: request.intensity,
    },
    styleExamples,
  );

  let backend = unmatchedRewriteBackend();
  let temperature = unmatchedRewriteTemperature(backend, request.intensity);
  const vertex = getVertexConfig();
  console.info("[humanize] [MODEL]", {
    backend,
    model:
      backend === "tuned" && vertex
        ? redactModelName(vertex.model)
        : redactModelName("gemini-2.5-flash"),
    styleExamples: styleExamples.length,
    intensity: request.intensity ?? 75,
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
  let copyRatio = phraseCopyRatio(request.text, output);
  let copiedTooClosely = copyRatio >= COPY_RETRY_RATIO;
  let droppedFacts = missingFactsForRetry(request.text, output);

  for (let attempt = 0; attempt < MAX_REWRITE_REPAIRS; attempt += 1) {
    if (!tooShort && !copiedTooClosely && droppedFacts.length === 0) break;

    // Tuned models sometimes echo the draft; escalate to base Gemini for anti-copy repairs.
    if (copiedTooClosely && backend === "tuned" && isGeminiApiConfigured()) {
      backend = "base";
      temperature = unmatchedRewriteTemperature(backend, request.intensity);
    }

    const repairTemperature = copiedTooClosely
      ? Math.min(1.05, temperature + 0.12 * (attempt + 1))
      : Math.max(0.4, temperature - 0.04 * (attempt + 1));

    console.info("[humanize] retrying because the rewrite is truncated, copied, or missing facts", {
      attempt: attempt + 1,
      tooShort,
      copiedTooClosely,
      copyRatio,
      droppedFacts,
      backend,
      repairTemperature,
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
The last version was too close to the draft (phrase overlap ${(copyRatio * 100).toFixed(0)}%). That is not a rewrite.
Rewrite like the AFTER examples from wikipedia_training_pairs: new sentence openings, different wording, same facts.
Do not reuse long phrases from the draft. Keep every fact, name, number, paragraph break, and about ${inputWords} words.`;

    const repaired = stripModelChrome(
      await rewriteWithModel(request, {
        backend,
        temperature: repairTemperature,
        systemInstruction: repairInstruction,
      }),
    );
    if (!repaired) break;

    const preferRepair =
      (tooShort && countWords(repaired) > countWords(output)) ||
      (copiedTooClosely &&
        phraseCopyRatio(request.text, repaired) < copyRatio - 0.02) ||
      rewritePenalty(request.text, repaired) < rewritePenalty(request.text, output);
    if (!preferRepair) break;

    output = repaired;
    tooShort = isShort(output);
    copyRatio = phraseCopyRatio(request.text, output);
    copiedTooClosely = copyRatio >= COPY_RETRY_RATIO;
    droppedFacts = missingFactsForRetry(request.text, output);
  }

  const quality = assessRewriteQuality(request.text, output);
  if (
    quality.issues.some(
      (issue) =>
        issue.code === "REFUSAL" ||
        issue.code === "LEAK" ||
        issue.code === "UNRELATED" ||
        issue.code === "TOO_SIMILAR",
    )
  ) {
    console.error("[humanize] model returned an unusable response", {
      codes: quality.issues.map((issue) => issue.code),
      copyRatio: phraseCopyRatio(request.text, output),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  output = quality.output || output;
  copyRatio = phraseCopyRatio(request.text, output);
  if (inputWords >= 80 && copyRatio >= COPY_REJECT_RATIO) {
    throw new HumanizationFailedError(
      "The rewrite copied the draft too closely. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

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

  output = formatEssayParagraphs(scrubAiEssayMarks(output));

  return {
    text: output.trim(),
    source: "FINE_TUNED_MODEL",
    retrieval: null,
  };
}

export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  // 1) Stored human training outputs (wikipedia_training_pairs / essay gold text).
  const storedHit = findTopicMatch(request.text) ?? findDatabaseMatch(request.text);
  if (storedHit) {
    return resolveStoredHit({
      ...storedHit,
      output: formatEssayParagraphs(
        applyInputTitle(storedHit.output, request.text),
      ),
    });
  }

  // 2) Live Wikipedia — real human encyclopedia prose (same style as pair outputs).
  // Never replace this with the tuned model: generated text is what detectors mark 100% AI.
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

    return resolveStoredHit({
      ...wikipediaHit,
      output,
    });
  }

  // 3) Last resort only: model rewrite + strip AI filler marks.
  if (canRewriteWithModel()) {
    console.info("[humanize] no human Wikipedia/training match; model rewrite with AI-mark scrub");
    return runModelHumanization(request);
  }

  throw new HumanizationFailedError(
    "No Wikipedia article matches this topic, and the rewrite model is not configured.",
    "NO_WIKIPEDIA_MATCH",
    422,
  );
}
