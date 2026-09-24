import "server-only";

import {
  GeminiError,
  generateText,
  generateTextStream,
  getGeminiApiModel,
  isGeminiApiConfigured,
  redactModelName,
} from "@/lib/gemini";
import { GrubbyError, humanizeWithGrubby, isGrubbyConfigured } from "@/lib/grubby";
import {
  buildRewriteUserContent,
  buildStyleRewriteInstruction,
} from "@/lib/humanize-prompt";
import { isGptZeroDetector, isZeroGptDetector } from "@/lib/humanize-detectors";
import { stripModelChrome } from "@/lib/humanize-quality";
import type { HumanizeApiSource } from "@/lib/training-schema";

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
const REWRITE_TEMPERATURE = 0.78;
const ACADEMIC_TURNITIN_TEMPERATURE = 0.5;
/** If Gemini has not streamed a word by then, switch to Grubby. */
const FIRST_TOKEN_MS = 4_000;

function usesAcademicTurnitinPrompt(detector?: string): boolean {
  return !isGptZeroDetector(detector);
}

function toHumanizationError(error: unknown): never {
  if (error instanceof HumanizationFailedError) throw error;
  if (error instanceof GeminiError || error instanceof GrubbyError) {
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

function rewriteOptions(request: HumanizeRequest) {
  const academicTurnitin = usesAcademicTurnitinPrompt(request.detector);
  return {
    systemInstruction: buildStyleRewriteInstruction({
      text: request.text,
      tone: request.tone,
      readability: request.readability,
      intensity: request.intensity,
      language: request.language,
      detector: request.detector,
    }),
    temperature: academicTurnitin ? ACADEMIC_TURNITIN_TEMPERATURE : REWRITE_TEMPERATURE,
    topP: REWRITE_TOP_P,
    backend: "base" as const,
    geminiApiOnly: true,
  };
}

async function rewriteWithGemini(
  request: HumanizeRequest,
  onDelta?: (visible: string) => void,
  session?: { live: boolean },
): Promise<string> {
  const model = getGeminiApiModel();
  console.info("[humanize] [GEMINI_API]", {
    model: redactModelName(model),
    prompt: isGptZeroDetector(request.detector)
      ? "gptzero"
      : isZeroGptDetector(request.detector)
        ? "zerogpt"
        : "academic-turnitin",
    intensity: request.intensity ?? 75,
    language: request.language ?? "en",
    tone: request.tone ?? "auto",
    detector: request.detector ?? "academic-turnitin",
    stream: Boolean(onDelta),
  });

  const options = rewriteOptions(request);
  const prompt = buildRewriteUserContent(request);
  if (!onDelta) {
    return generateText(prompt, options);
  }

  let gotToken = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<string>((_, reject) => {
    timer = setTimeout(() => {
      if (!gotToken) {
        reject(new GeminiError("The writing service did not start in time.", "TIMEOUT", 504));
      }
    }, FIRST_TOKEN_MS);
  });

  try {
    return await Promise.race([
      generateTextStream(prompt, {
        ...options,
        onDelta: (_chunk, accumulated) => {
          if (session && !session.live) return;
          gotToken = true;
          if (timer) clearTimeout(timer);
          onDelta(stripModelChrome(accumulated));
        },
      }),
      watchdog,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function rewriteWithGrubby(
  request: HumanizeRequest,
  onDelta?: (visible: string) => void,
): Promise<string> {
  console.info("[humanize] [GRUBBY]", {
    language: request.language ?? "en",
    detector: request.detector ?? "academic-turnitin",
  });
  const output = stripModelChrome(await humanizeWithGrubby(request.text));
  if (output) onDelta?.(output);
  return output;
}

/**
 * Humanize tries Gemini API + the stored detector prompt first.
 * If that 500s, returns empty, or does not start in 4s, Grubby finishes the rewrite
 * so the live pane cannot die on a single flaky model.
 */
export async function runHumanization(
  request: HumanizeRequest,
  onDelta?: (visible: string) => void,
): Promise<HumanizeResult> {
  if (!isGeminiApiConfigured() && !isGrubbyConfigured()) {
    throw new HumanizationFailedError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
      503,
    );
  }

  try {
    let lastError: unknown = null;
    const session = { live: true };

    if (isGeminiApiConfigured()) {
      try {
        const output = stripModelChrome(await rewriteWithGemini(request, onDelta, session));
        if (output) {
          return {
            text: output.trim(),
            source: "FINE_TUNED_MODEL",
            retrieval: null,
          };
        }
        lastError = new HumanizationFailedError("Empty model response.", "EMPTY_RESPONSE", 502);
      } catch (error) {
        lastError = error;
        session.live = false;
        console.error("[humanize] gemini failed, trying Grubby", {
          code: error instanceof GeminiError ? error.code : undefined,
          status: error instanceof GeminiError ? error.status : undefined,
        });
      }
    }

    if (isGrubbyConfigured()) {
      const output = await rewriteWithGrubby(request, onDelta);
      if (!output) {
        throw lastError ?? new HumanizationFailedError("Empty model response.", "EMPTY_RESPONSE", 502);
      }
      return {
        text: output.trim(),
        source: "FINE_TUNED_MODEL",
        retrieval: null,
      };
    }

    toHumanizationError(lastError ?? new HumanizationFailedError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
      503,
    ));
  } catch (error) {
    toHumanizationError(error);
  }
}
