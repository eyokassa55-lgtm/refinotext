import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai/node";

import { getGoogleAuthOptions, VertexAuthError } from "@/lib/vertex-auth";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GEMINI_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS_PER_MODEL = 3;
const DEFAULT_VERTEX_LOCATION = "us-central1";

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

export type GenerateTextOptions = {
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
};

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

export type VertexConfig = {
  project: string;
  location: string;
  endpoint: string;
  model: string;
};

function parseVertexResource(value: string): {
  project?: string;
  location?: string;
} {
  const match = value.match(/projects\/([^/]+)\/locations\/([^/]+)\//);
  if (!match) return {};
  return { project: match[1], location: match[2] };
}

function extractResourceFromUrl(endpoint: string): string | undefined {
  const match = endpoint.match(
    /\/(projects\/[^/]+\/locations\/[^/]+\/(?:endpoints|models)\/[^/?#]+)/,
  );
  return match?.[1];
}

/**
 * Build the SDK model name from TUNED_MODEL_ENDPOINT (or VERTEX_AI_TUNED_ENDPOINT)
 * without inventing an ID. Full resource names are used exactly as provided.
 */
export function resolveTunedModelName(
  project: string,
  location: string,
  endpoint: string,
): string {
  const trimmed = endpoint.trim();
  const fromUrl = extractResourceFromUrl(trimmed);
  if (fromUrl) return fromUrl;
  if (trimmed.startsWith("projects/")) return trimmed;
  if (trimmed.startsWith("endpoints/") || trimmed.startsWith("models/")) {
    return `projects/${project}/locations/${location}/${trimmed}`;
  }
  return `projects/${project}/locations/${location}/endpoints/${trimmed}`;
}

export function getTunedEndpointEnv(): string | undefined {
  return cleanEnv(process.env.TUNED_MODEL_ENDPOINT) || cleanEnv(process.env.VERTEX_AI_TUNED_ENDPOINT);
}

export function hasVertexEndpointEnv(): boolean {
  return Boolean(getTunedEndpointEnv());
}

function isInvalidEndpointValue(endpoint: string): boolean {
  return (
    /^gemini-/i.test(endpoint) ||
    /\/publishers\/google\/models\/gemini-/i.test(endpoint) ||
    endpoint.includes("generativelanguage.googleapis.com") ||
    endpoint.includes("gemini-api")
  );
}

function resolveVertexConfig(): VertexConfig {
  const endpoint = getTunedEndpointEnv();
  if (!endpoint) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "MISSING_VERTEX_CONFIG",
      503,
    );
  }

  if (isInvalidEndpointValue(endpoint)) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "INVALID_VERTEX_ENDPOINT",
      503,
    );
  }

  const resourceHint = extractResourceFromUrl(endpoint) ?? endpoint;
  const parsed = parseVertexResource(resourceHint);
  const project = cleanEnv(process.env.GOOGLE_CLOUD_PROJECT) || parsed.project;
  const location =
    parsed.location ||
    cleanEnv(process.env.GOOGLE_CLOUD_LOCATION) ||
    cleanEnv(process.env.VERTEX_AI_LOCATION) ||
    DEFAULT_VERTEX_LOCATION;

  if (!project) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "MISSING_VERTEX_CONFIG",
      503,
    );
  }

  return {
    project,
    location,
    endpoint,
    model: resolveTunedModelName(project, location, endpoint),
  };
}

export function getVertexConfig(): VertexConfig | null {
  try {
    return resolveVertexConfig();
  } catch {
    return null;
  }
}

export function requireVertexConfig(): VertexConfig {
  return resolveVertexConfig();
}

export function isVertexConfigured(): boolean {
  try {
    resolveVertexConfig();
    return true;
  } catch {
    return false;
  }
}

export function isBaseGeminiFallbackEnabled(): boolean {
  return cleanEnv(process.env.ALLOW_BASE_GEMINI_FALLBACK)?.toLowerCase() === "true";
}

export function redactModelName(model: string): string {
  const endpointMatch = model.match(/\/(endpoints\/[^/]+)$/);
  if (endpointMatch?.[1]) return endpointMatch[1];
  const modelMatch = model.match(/\/(models\/[^/]+)$/);
  if (modelMatch?.[1]) return modelMatch[1];
  if (model.startsWith("gemini-")) return model;
  return "tuned-endpoint";
}

function getApiKey(): string {
  const apiKey = cleanEnv(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new GeminiError(
      "The writing service is not configured.",
      "MISSING_API_KEY",
    );
  }
  return apiKey;
}

export function getGeminiModel(): string {
  const vertex = getVertexConfig();
  if (vertex) return vertex.model;

  const model = cleanEnv(process.env.GEMINI_MODEL);
  return model || DEFAULT_GEMINI_MODEL;
}

function loadGoogleAuthOptions() {
  try {
    return getGoogleAuthOptions();
  } catch (error) {
    if (error instanceof VertexAuthError) {
      throw new GeminiError(
        "The writing service could not be authorized. Please try again later.",
        error.code,
        401,
      );
    }
    throw error;
  }
}

let vertexClient: GoogleGenAI | null = null;
let geminiApiClient: GoogleGenAI | null = null;

function getVertexClient(config: VertexConfig): GoogleGenAI {
  if (!vertexClient) {
    vertexClient = new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      googleAuthOptions: loadGoogleAuthOptions(),
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    });
  }

  return vertexClient;
}

function getGeminiApiClient(): GoogleGenAI {
  if (!geminiApiClient) {
    geminiApiClient = new GoogleGenAI({
      apiKey: getApiKey(),
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    });
  }

  return geminiApiClient;
}

function stripSecrets(value: string): string {
  return value
    .replace(/key=[^&\s]+/gi, "key=[redacted]")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted]")
    .replace(/"private_key"\s*:\s*"[^"]+"/gi, '"private_key":"[redacted]"')
    .replace(/"client_email"\s*:\s*"[^"]+"/gi, '"client_email":"[redacted]"');
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

function modelsToTry(): { provider: "vertex" | "gemini-api"; model: string }[] {
  if (hasVertexEndpointEnv()) {
    const vertex = requireVertexConfig();
    if (isInvalidEndpointValue(vertex.model) || /^gemini-/i.test(vertex.model)) {
      throw new GeminiError(
        "The writing service is not configured. Please try again later.",
        "INVALID_VERTEX_ENDPOINT",
        503,
      );
    }
    return [{ provider: "vertex", model: vertex.model }];
  }

  if (!isBaseGeminiFallbackEnabled()) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "MISSING_VERTEX_CONFIG",
      503,
    );
  }

  const primary = getGeminiModel();
  return [
    { provider: "gemini-api" as const, model: primary },
    ...GEMINI_API_FALLBACK_MODELS.filter((model) => model !== primary).map((model) => ({
      provider: "gemini-api" as const,
      model,
    })),
  ];
}

export function sanitizeGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error;
  if (error instanceof VertexAuthError) {
    return new GeminiError(
      "The writing service could not be authorized. Please try again later.",
      error.code,
      401,
    );
  }

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

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("unauthenticated") ||
    lower.includes("could not load the default credentials")
  ) {
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
      "The writing service is temporarily unavailable. Try again shortly.",
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

function maxOutputTokensFor(text: string, requested?: number): number {
  if (requested) return Math.min(8192, Math.max(256, requested));
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(8192, Math.max(256, Math.ceil(words * 2.2) + 160));
}

/**
 * Keep the live draft as close as possible to training `ai_text`:
 * BOM/CRLF cleanup only. Do not wrap, prefix, or collapse paragraphs.
 */
export function preserveSourceText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

async function generateOnce(
  provider: "vertex" | "gemini-api",
  model: string,
  userText: string,
  options: GenerateTextOptions,
): Promise<string> {
  if (provider === "vertex" && (isInvalidEndpointValue(model) || /^gemini-/i.test(model))) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "INVALID_VERTEX_ENDPOINT",
      503,
    );
  }

  const client =
    provider === "vertex"
      ? getVertexClient(requireVertexConfig())
      : getGeminiApiClient();

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
    config: {
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
      temperature: options.temperature ?? (provider === "vertex" ? 0 : 0.7),
      topP: options.topP ?? (provider === "vertex" ? 0.1 : 0.95),
      maxOutputTokens: maxOutputTokensFor(userText, options.maxOutputTokens),
      candidateCount: 1,
      ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
    },
  });

  const text = response.text?.trim();
  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new GeminiError(
      finishReason === "SAFETY" || finishReason === "BLOCKLIST"
        ? "This text could not be rewritten. Try different wording."
        : "The writing service returned an empty response.",
      "EMPTY_RESPONSE",
      502,
    );
  }

  return text;
}

/**
 * Server-side text generation with retries.
 * When TUNED_MODEL_ENDPOINT (or VERTEX_AI_TUNED_ENDPOINT) is set, only that
 * tuned Vertex resource is called — never gemini-2.5-flash-lite as a base model.
 */
export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const trimmed = preserveSourceText(prompt);
  if (!trimmed) {
    throw new GeminiError("Prompt cannot be empty.", "EMPTY_PROMPT");
  }

  let lastError: GeminiError | null = null;

  for (const target of modelsToTry()) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        console.info("[gemini] generateContent", {
          provider: target.provider,
          model: redactModelName(target.model),
          location: target.provider === "vertex" ? getVertexConfig()?.location : undefined,
          baseGemini: target.provider !== "vertex",
          attempt,
        });
        return await generateOnce(target.provider, target.model, trimmed, options);
      } catch (error) {
        const sanitized = sanitizeGeminiError(error);
        lastError = sanitized;
        console.error("[gemini] request failed", {
          provider: target.provider,
          model: redactModelName(target.model),
          attempt,
          code: sanitized.code,
          status: sanitized.status,
        });

        if (sanitized.code === "MODEL_NOT_FOUND") break;
        if (sanitized.code === "INVALID_VERTEX_ENDPOINT") throw sanitized;
        if (sanitized.code === "INVALID_SERVICE_ACCOUNT") throw sanitized;
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
