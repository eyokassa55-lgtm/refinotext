import "server-only";

import {
  GeminiError,
  generateText,
  getGeminiApiModel,
  isGeminiApiConfigured,
  redactModelName,
} from "@/lib/gemini";
import {
  buildRewriteUserContent,
  buildStyleRewriteInstruction,
} from "@/lib/humanize-prompt";
import {
  isAcademicTurnitinDetector,
  isGptZeroDetector,
  isZeroGptDetector,
} from "@/lib/humanize-detectors";
import { stripModelChrome } from "@/lib/humanize-quality";
import { formatEssayParagraphs, extractUserTitle } from "@/lib/humanize-output";
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

function usesAcademicTurnitinPrompt(detector?: string): boolean {
  return isAcademicTurnitinDetector(detector) || (!isGptZeroDetector(detector) && !isZeroGptDetector(detector));
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

function attachInputTitle(output: string, input: string): string {
  const titled = extractUserTitle(input);
  if (!titled) return output;
  let body = output.replace(/^#\s+[^\n]+\n*/, "").trim();
  const firstLine = body.split(/\n/)[0]?.trim() ?? "";
  if (firstLine.toLowerCase() === titled.toLowerCase()) {
    body = body.slice(firstLine.length).replace(/^\n+/, "").trim();
  }
  return `${titled}\n\n${body}`;
}

async function rewriteWithGemini(request: HumanizeRequest): Promise<string> {
  const systemInstruction = buildStyleRewriteInstruction({
    text: request.text,
    tone: request.tone,
    readability: request.readability,
    intensity: request.intensity,
    language: request.language,
    detector: request.detector,
  });
  const academicTurnitin = usesAcademicTurnitinPrompt(request.detector);
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
  });

  return generateText(buildRewriteUserContent(request), {
    systemInstruction,
    temperature: academicTurnitin ? ACADEMIC_TURNITIN_TEMPERATURE : REWRITE_TEMPERATURE,
    topP: REWRITE_TOP_P,
    backend: "base",
    geminiApiOnly: true,
  });
}

/**
 * Humanize is Gemini API + the style system prompt only.
 * No Wikipedia, no training lookup, no Vertex, no local rewrite.
 */
export async function runHumanization(request: HumanizeRequest): Promise<HumanizeResult> {
  if (!isGeminiApiConfigured()) {
    throw new HumanizationFailedError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
      503,
    );
  }

  try {
    let output = stripModelChrome(await rewriteWithGemini(request));
    if (!output) {
      throw new HumanizationFailedError("Empty model response.", "EMPTY_RESPONSE", 502);
    }

    // Keep the six-paragraph academic mould. Do not reflow or add a title.
    if (!usesAcademicTurnitinPrompt(request.detector)) {
      output = formatEssayParagraphs(attachInputTitle(output, request.text));
    }

    return {
      text: output.trim(),
      source: "FINE_TUNED_MODEL",
      retrieval: null,
    };
  } catch (error) {
    toHumanizationError(error);
  }
}
