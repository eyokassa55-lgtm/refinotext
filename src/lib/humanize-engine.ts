import "server-only";

import {
  GeminiError,
  generateText,
  generateTextStream,
  getGeminiApiModel,
  isGeminiApiConfigured,
  redactModelName,
} from "@/lib/gemini";
import {
  buildRewriteUserContent,
  buildWikipediaRewriteInstruction,
} from "@/lib/humanize-prompt";
import { stripModelChrome } from "@/lib/humanize-quality";
import type { HumanizeApiSource } from "@/lib/training-schema";
import { findWikipediaLiveMatch } from "@/lib/wikipedia-corpus";

export type HumanizeRequest = {
  text: string;
  tone?: string;
  readability?: string;
  intensity?: number;
  language?: string;
  detector?: string;
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
const REWRITE_TEMPERATURE = 0.62;
/** Nothing streams until the voice reference resolves, so cap the wait. */
const WIKI_WAIT_MS = 1_600;

type WikiMatch = Awaited<ReturnType<typeof findWikipediaLiveMatch>>;

async function findVoiceReference(text: string): Promise<WikiMatch> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      findWikipediaLiveMatch(text).catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), WIKI_WAIT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toHumanizationError(error: unknown): never {
  if (error instanceof HumanizationFailedError) throw error;
  if (error instanceof GeminiError) {
    throw new HumanizationFailedError(
      error.message,
      error.code || "HUMANIZATION_FAILED",
      error.status ?? 502,
    );
  }
  throw error;
}

export function toApiSource(source: HumanizeSource): HumanizeApiSource {
  return source === "FINE_TUNED_MODEL" ? "model" : "database";
}

/**
 * Humanize uses live Wikipedia + Gemini only.
 * Stored detector system prompts are not sent.
 */
export async function runHumanization(
  request: HumanizeRequest,
  onDelta?: (visible: string) => void,
): Promise<HumanizeResult> {
  if (!isGeminiApiConfigured()) {
    throw new HumanizationFailedError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
      503,
    );
  }

  try {
    const wiki = await findVoiceReference(request.text);
    const model = getGeminiApiModel();
    console.info("[humanize] [WIKIPEDIA_GEMINI]", {
      model: redactModelName(model),
      wikiTopic: wiki?.topic ?? null,
      wikiScore: wiki?.score ?? null,
      language: request.language ?? "en",
      stream: Boolean(onDelta),
    });

    const options = {
      systemInstruction: buildWikipediaRewriteInstruction(wiki),
      temperature: REWRITE_TEMPERATURE,
      topP: REWRITE_TOP_P,
      backend: "base" as const,
      geminiApiOnly: true,
    };
    const prompt = buildRewriteUserContent(request);
    const raw = onDelta
      ? await generateTextStream(prompt, {
          ...options,
          onDelta: (_chunk, accumulated) => {
            onDelta(stripModelChrome(accumulated));
          },
        })
      : await generateText(prompt, options);

    const output = stripModelChrome(raw);
    if (!output) {
      throw new HumanizationFailedError("Empty model response.", "EMPTY_RESPONSE", 502);
    }

    return {
      text: output.trim(),
      source: wiki ? "TOPIC_TRAINING_MATCH" : "FINE_TUNED_MODEL",
      retrieval: wiki
        ? { band: "high", matches: [{ index: wiki.index, score: wiki.score }] }
        : null,
    };
  } catch (error) {
    toHumanizationError(error);
  }
}
