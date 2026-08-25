import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai/node";

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GEMINI_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS_PER_MODEL = 3;

export class GeminiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

function getApiKey(): string {
  const apiKey = (
    process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
  )
    ?.trim()
    .replace(/^["']|["']$/g, "");
  if (!apiKey) {
    throw new GeminiError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
    );
  }
  return apiKey;
}

export function getGeminiModel(): string {
  const model = (
    process.env.GEMINI_MODEL ?? process.env.GEMINI_MODEL
  )
    ?.trim()
    .replace(/^["']|["']$/g, "");
  return model || DEFAULT_MODEL;
}

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: getApiKey(),
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    });
  }

  return geminiClient;
}

function stripSecrets(value: string): string {
  return value
    .replace(/key=[^&\s]+/gi, "key=[redacted]")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]");
}

function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelsToTry(): string[] {
  const primary = getGeminiModel();
  return [primary, ...FALLBACK_MODELS.filter((model) => model !== primary)];
}

export function sanitizeGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error;

  const status = getHttpStatus(error);
  const raw =
    error instanceof Error ? error.message : "Gemini request failed.";
  const message = stripSecrets(raw);
  const lower = message.toLowerCase();

  if (
    status === 504 ||
    (error instanceof Error && error.name === "TimeoutError") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return new GeminiError(
      "The request took too long and was stopped. Try a shorter text or try again.",
      "TIMEOUT",
      504,
    );
  }

  if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("permission")) {
    return new GeminiError(
      "The writing service could not be authorized. Please try again later.",
      "UNAUTHORIZED",
      status ?? 401,
    );
  }

  if (status === 429 || lower.includes("quota") || lower.includes("resource exhausted")) {
    return new GeminiError(
      "The writing service is busy. Please try again in a moment.",
      "RATE_LIMITED",
      429,
    );
  }

  if (
    status === 503 ||
    status === 502 ||
    lower.includes("overloaded") ||
    lower.includes("high demand") ||
    lower.includes("unavailable")
  ) {
    return new GeminiError(
      "Gemini is temporarily unavailable. Try again shortly.",
      "UNAVAILABLE",
      status ?? 503,
    );
  }

  if (status === 404 || lower.includes("not found")) {
    return new GeminiError(
      "The writing service is temporarily unavailable. Please try again later.",
      "MODEL_NOT_FOUND",
      404,
    );
  }

  return new GeminiError(
    "Humanization failed. Please try again.",
    "GEMINI_ERROR",
    status ?? 502,
  );
}

function isRetryable(error: GeminiError): boolean {
  return (
    error.code === "UNAVAILABLE" ||
    error.code === "RATE_LIMITED" ||
    error.code === "TIMEOUT" ||
    error.code === "EMPTY_RESPONSE"
  );
}

async function generateOnce(model: string, prompt: string): Promise<string> {
  const response = await getGeminiClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    config: {
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
      temperature: 0.7,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new GeminiError(
      finishReason === "SAFETY" || finishReason === "BLOCKLIST"
        ? "This text could not be rewritten. Try different wording."
        : "Gemini returned an empty response.",
      "EMPTY_RESPONSE",
      502,
    );
  }

  return text;
}

/**
 * Server-side text generation with retries and model fallback.
 */
export async function generateText(prompt: string): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new GeminiError("Prompt cannot be empty.", "EMPTY_PROMPT");
  }

  let lastError: GeminiError | null = null;

  for (const model of modelsToTry()) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        return await generateOnce(model, trimmed);
      } catch (error) {
        const sanitized = sanitizeGeminiError(error);
        lastError = sanitized;
        console.error("[gemini] request failed", {
          model,
          attempt,
          code: sanitized.code,
          status: sanitized.status,
        });

        if (sanitized.code === "MODEL_NOT_FOUND") break;
        if (!isRetryable(sanitized) || attempt === MAX_ATTEMPTS_PER_MODEL) {
          if (!isRetryable(sanitized)) throw sanitized;
          break;
        }

        await sleep(400 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError ?? new GeminiError("Humanization failed. Please try again.", "GEMINI_ERROR", 502);
}
