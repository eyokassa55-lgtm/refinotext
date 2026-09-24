import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai/node";

import { getGoogleAuthOptions, VertexAuthError } from "@/lib/vertex-auth";

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
/** Fastest billed model first. 3.6 Flash stays in the chain if preview is busy. */
const GEMINI_API_FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
];
/**
 * Google rejects deadlines under 10s. 10s is also too short for the stored
 * detector prompt (~3k tokens) — the call 504s and the UI shows unavailable.
 */
const GEMINI_TIMEOUT_MS = 16_000;
const VERTEX_TIMEOUT_MS = 60_000;
/** Leave time to send an SSE error before Vercel kills the function. */
const TOTAL_BUDGET_MS = 40_000;
const MAX_ATTEMPTS_PER_MODEL = 2;
const MAX_GEMINI_API_ATTEMPTS = 1;
const DEFAULT_VERTEX_LOCATION = "us-central1";
/** Dead or retired IDs — never send these on the Gemini API path. */
const BROKEN_GEMINI_API_MODELS = new Set([
  "gemini-flash-latest",
  "gemini-3.6-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
]);
/**
 * Served, but they stall for 25s+ or reject `thinkingLevel` before the first
 * word. Humanize swaps them for DEFAULT_GEMINI_MODEL.
 */
const SLOW_GEMINI_API_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
]);

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

export type GenerateBackend = "tuned" | "base";

export type GenerateTextOptions = {
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  /** `tuned` is the Vertex endpoint. `base` is a publisher Gemini model for new drafts. */
  backend?: GenerateBackend;
  /** 0 disables thinking so the full rewrite is not eaten by thought tokens. */
  thinkingBudget?: number;
  /** Humanize path: GEMINI_API_KEY only — never Vertex. */
  geminiApiOnly?: boolean;
  /** Called with each new piece and the full text so far. */
  onDelta?: (chunk: string, accumulated: string) => void;
};

const BASE_VERTEX_MODEL = "gemini-2.5-flash";
type GenerateProvider = "vertex" | "vertex-base" | "gemini-api";

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

export function isGeminiApiConfigured(): boolean {
  return Boolean(cleanEnv(process.env.GEMINI_API_KEY));
}

/** @deprecated Gemini API is used automatically when Vertex is not configured. */
export function isBaseGeminiFallbackEnabled(): boolean {
  return (
    isGeminiApiConfigured() ||
    cleanEnv(process.env.ALLOW_BASE_GEMINI_FALLBACK)?.toLowerCase() === "true"
  );
}

export function redactModelName(model: string): string {
  const endpointMatch = model.match(/\/(endpoints\/[^/]+)$/);
  if (endpointMatch?.[1]) return endpointMatch[1];
  const modelMatch = model.match(/\/(models\/[^/]+)$/);
  if (modelMatch?.[1]) return modelMatch[1];
  if (model.startsWith("gemini-") || model.startsWith("gemma-")) return model;
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

export function getGeminiApiModel(): string {
  const model = cleanEnv(process.env.GEMINI_MODEL)?.replace(/-+$/, "");
  if (
    model &&
    /^(gemini|gemma)-/i.test(model) &&
    !model.includes("endpoints/") &&
    !BROKEN_GEMINI_API_MODELS.has(model.toLowerCase())
  ) {
    if (SLOW_GEMINI_API_MODELS.has(model.toLowerCase())) {
      return DEFAULT_GEMINI_MODEL;
    }
    return model;
  }
  return DEFAULT_GEMINI_MODEL;
}

export function getGeminiModel(): string {
  const vertex = getVertexConfig();
  if (vertex) return vertex.model;
  return getGeminiApiModel();
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
      httpOptions: { timeout: VERTEX_TIMEOUT_MS },
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

function geminiApiTargets(limit?: number): { provider: GenerateProvider; model: string }[] {
  const targets: { provider: GenerateProvider; model: string }[] = [];
  if (!isGeminiApiConfigured()) return targets;
  const preferred = DEFAULT_GEMINI_MODEL;
  if (!BROKEN_GEMINI_API_MODELS.has(preferred)) {
    targets.push({ provider: "gemini-api", model: preferred });
  }
  const configured = getGeminiApiModel();
  if (
    configured !== preferred &&
    /^(gemini|gemma)-/i.test(configured) &&
    !BROKEN_GEMINI_API_MODELS.has(configured.toLowerCase())
  ) {
    targets.push({ provider: "gemini-api", model: configured });
  }
  for (const model of GEMINI_API_FALLBACK_MODELS) {
    if (!targets.some((target) => target.provider === "gemini-api" && target.model === model)) {
      targets.push({ provider: "gemini-api", model });
    }
  }
  return typeof limit === "number" ? targets.slice(0, Math.max(1, limit)) : targets;
}

function modelsToTry(
  backend: GenerateBackend = "tuned",
  geminiApiOnly = false,
): { provider: GenerateProvider; model: string }[] {
  if (geminiApiOnly) {
    const targets = geminiApiTargets(3);
    if (targets.length === 0) {
      throw new GeminiError(
        "The writing service is not configured. Please try again later.",
        "MISSING_API_KEY",
        503,
      );
    }
    return targets;
  }

  const targets: { provider: GenerateProvider; model: string }[] = [];

  if (backend === "tuned" && hasVertexEndpointEnv()) {
    const vertex = requireVertexConfig();
    if (isInvalidEndpointValue(vertex.model) || /^gemini-/i.test(vertex.model)) {
      throw new GeminiError(
        "The writing service is not configured. Please try again later.",
        "INVALID_VERTEX_ENDPOINT",
        503,
      );
    }
    targets.push({ provider: "vertex", model: vertex.model });
  }

  targets.push(...geminiApiTargets());

  // Vertex publisher model last — this project often returns 403 here.
  if (isVertexConfigured()) {
    targets.push({ provider: "vertex-base", model: BASE_VERTEX_MODEL });
  }

  // If we asked for base but Gemini/Vertex base are down, still try the tuned endpoint.
  if (backend === "base" && hasVertexEndpointEnv()) {
    try {
      const vertex = requireVertexConfig();
      if (
        !isInvalidEndpointValue(vertex.model) &&
        !/^gemini-/i.test(vertex.model) &&
        !targets.some((target) => target.provider === "vertex" && target.model === vertex.model)
      ) {
        targets.push({ provider: "vertex", model: vertex.model });
      }
    } catch {
      // ignore — tuned endpoint unavailable
    }
  }

  if (targets.length === 0) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "MISSING_API_KEY",
      503,
    );
  }

  return targets;
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
    status === 404 ||
    lower.includes("not found") ||
    lower.includes("is not found") ||
    lower.includes("invalid model") ||
    lower.includes("model not found") ||
    lower.includes("no longer available")
  ) {
    return new GeminiError(
      "The writing service is temporarily unavailable. Please try again later.",
      "MODEL_NOT_FOUND",
      404,
    );
  }

  if (
    status === 500 ||
    status === 503 ||
    status === 502 ||
    lower.includes("overloaded") ||
    lower.includes("high demand") ||
    lower.includes("internal error") ||
    lower.includes("unavailable")
  ) {
    return new GeminiError(
      "The writing service is temporarily unavailable. Try again shortly.",
      "UNAVAILABLE",
      status ?? 503,
    );
  }

  return new GeminiError(
    "Humanization failed. Please try again.",
    "GEMINI_ERROR",
    status ?? 502,
  );
}

function isRetryable(error: GeminiError): boolean {
  return error.code === "UNAVAILABLE" || error.code === "RATE_LIMITED";
}

function maxOutputTokensFor(text: string, requested?: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sized = Math.min(2048, Math.max(768, Math.ceil(words * 2.4) + 200));
  if (requested) return Math.min(sized, Math.max(256, requested));
  return sized;
}

function isGemini3Model(model: string): boolean {
  const id = model.toLowerCase();
  return (
    id.includes("gemini-3") ||
    id.includes("flash-lite-latest") ||
    id.includes("flash-latest")
  );
}

function thinkingConfigFor(
  model: string,
  requested?: number,
  _systemInstruction?: string,
) {
  const id = model.toLowerCase();
  // Gemma rejects thinkingConfig. Gemini 3 must get lowercase "minimal"
  // or it thinks until the request is killed.
  if (id.includes("gemma")) {
    return {};
  }

  if (isGemini3Model(model)) {
    return {
      thinkingConfig: {
        // API expects lowercase. The SDK enum value "MINIMAL" is ignored and
        // the model thinks at the default level until the 45s timeout.
        thinkingLevel: "minimal" as ThinkingLevel,
        includeThoughts: false,
      },
    };
  }

  const budget = typeof requested === "number" ? requested : 0;
  return {
    thinkingConfig: {
      thinkingBudget: Math.max(0, budget),
      includeThoughts: false,
    },
  };
}

/**
 * Keep the live draft as close as possible to training user text:
 * BOM/CRLF cleanup only. Do not wrap, prefix, or collapse paragraphs.
 */
export function preserveSourceText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function assertVertexModel(provider: GenerateProvider, model: string) {
  if (provider === "vertex" && (isInvalidEndpointValue(model) || /^gemini-/i.test(model))) {
    throw new GeminiError(
      "The writing service is not configured. Please try again later.",
      "INVALID_VERTEX_ENDPOINT",
      503,
    );
  }
}

function buildGenerateRequest(
  provider: GenerateProvider,
  model: string,
  userText: string,
  options: GenerateTextOptions,
) {
  assertVertexModel(provider, model);

  const client =
    provider === "gemini-api"
      ? getGeminiApiClient()
      : getVertexClient(requireVertexConfig());
  const tuned = provider === "vertex";

  return {
    client,
    params: {
      model,
      contents: [
        {
          role: "user" as const,
          parts: [{ text: userText }],
        },
      ],
      config: {
        temperature: options.temperature ?? (tuned ? 0 : 0.72),
        topP: options.topP ?? (tuned ? 0.1 : 0.95),
        maxOutputTokens: maxOutputTokensFor(userText, options.maxOutputTokens),
        candidateCount: 1,
        ...thinkingConfigFor(model, options.thinkingBudget, options.systemInstruction),
        ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
        ...(provider === "gemini-api" ? { httpOptions: { timeout: GEMINI_TIMEOUT_MS } } : {}),
      },
    },
  };
}

function visibleModelText(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const direct = response.text?.trim();
  if (direct) return direct;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function emptyResponseError(finishReason?: string) {
  return new GeminiError(
    finishReason === "SAFETY" || finishReason === "BLOCKLIST"
      ? "This text could not be rewritten. Try different wording."
      : "The writing service returned an empty response.",
    "EMPTY_RESPONSE",
    502,
  );
}

async function generateOnce(
  provider: GenerateProvider,
  model: string,
  userText: string,
  options: GenerateTextOptions,
): Promise<string> {
  const { client, params } = buildGenerateRequest(provider, model, userText, options);
  const response = await client.models.generateContent(params);
  const text = visibleModelText(response);
  if (!text) {
    throw emptyResponseError(response.candidates?.[0]?.finishReason);
  }
  return text;
}

async function generateOnceStream(
  provider: GenerateProvider,
  model: string,
  userText: string,
  options: GenerateTextOptions,
): Promise<string> {
  const { client, params } = buildGenerateRequest(provider, model, userText, options);
  const stream = await client.models.generateContentStream(params);

  let text = "";
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    const piece =
      chunk.text ||
      parts
        .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
        .join("");
    if (!piece) continue;
    text += piece;
    options.onDelta?.(piece, text);
  }

  if (text.trim()) {
    return text;
  }

  // Some Gemini models finish a stream with no visible tokens. One non-stream
  // call on the same model usually has the rewrite.
  const fallback = await generateOnce(provider, model, userText, options);
  options.onDelta?.(fallback, fallback);
  return fallback;
}

/**
 * Server-side text generation with retries.
 * `backend: "tuned"` uses the Vertex endpoint. `backend: "base"` uses a
 * publisher Gemini model so new drafts are not sent to a lookup-tuned endpoint.
 */
async function generateWithRetries(
  prompt: string,
  options: GenerateTextOptions,
  runner: (
    provider: GenerateProvider,
    model: string,
    userText: string,
    options: GenerateTextOptions,
  ) => Promise<string>,
): Promise<string> {
  const trimmed = preserveSourceText(prompt);
  if (!trimmed) {
    throw new GeminiError("Prompt cannot be empty.", "EMPTY_PROMPT");
  }

  let lastError: GeminiError | null = null;
  const backend = options.backend ?? "tuned";
  const geminiApiOnly = options.geminiApiOnly === true;
  const maxAttempts = geminiApiOnly ? MAX_GEMINI_API_ATTEMPTS : MAX_ATTEMPTS_PER_MODEL;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const target of modelsToTry(backend, geminiApiOnly)) {
    // Better to surface the last error than to keep the user waiting.
    if (Date.now() >= deadline && lastError) break;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let emitted = false;
      try {
        console.info("[gemini] generateContent", {
          provider: target.provider,
          model: redactModelName(target.model),
          location: target.provider === "gemini-api" ? undefined : getVertexConfig()?.location,
          baseGemini: target.provider !== "vertex",
          attempt,
          stream: Boolean(options.onDelta),
        });
        return await runner(target.provider, target.model, trimmed, {
          ...options,
          onDelta: options.onDelta
            ? (chunk, accumulated) => {
                emitted = true;
                options.onDelta?.(chunk, accumulated);
              }
            : undefined,
        });
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

        // Tokens already reached the client — do not start a second draft.
        if (emitted) throw sanitized;

        if (sanitized.code === "MODEL_NOT_FOUND") break;
        if (
          sanitized.code === "INVALID_VERTEX_ENDPOINT" ||
          sanitized.code === "INVALID_SERVICE_ACCOUNT" ||
          sanitized.code === "UNAUTHORIZED" ||
          sanitized.code === "MISSING_API_KEY"
        ) {
          break;
        }
        // Empty / 500 / 503: leave this model and try the next Gemini ID.
        if (
          sanitized.code === "EMPTY_RESPONSE" ||
          sanitized.code === "UNAVAILABLE" ||
          sanitized.code === "TIMEOUT" ||
          !isRetryable(sanitized) ||
          attempt === maxAttempts
        ) {
          break;
        }

        await sleep(400 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError ?? new GeminiError("Humanization failed. Please try again.", "GEMINI_ERROR", 502);
}

export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const { onDelta: _onDelta, ...rest } = options;
  return generateWithRetries(prompt, rest, generateOnce);
}

export async function generateTextStream(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  return generateWithRetries(prompt, options, generateOnceStream);
}
