import "server-only";

const FIREWORKS_CHAT_URL =
  "https://api.fireworks.ai/inference/v1/chat/completions";
const FIREWORKS_COMPLETIONS_URL =
  "https://api.fireworks.ai/inference/v1/completions";
const FIREWORKS_TIMEOUT_MS = 60_000;
const FIREWORKS_MAX_TOKENS = 4096;

export class FireworksError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "FireworksError";
    this.code = code;
    this.status = status;
  }
}

export type FireworksUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type FireworksGenerationResult = {
  text: string;
  model: string;
  latencyMs: number;
  usage?: FireworksUsage;
};

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

function getFireworksApiKey(): string | undefined {
  return cleanEnv(process.env.FIREWORKS_API_KEY);
}

export function getFireworksModel(): string | undefined {
  return cleanEnv(process.env.FIREWORKS_MODEL);
}

export function isFireworksEnabled(): boolean {
  return Boolean(getFireworksApiKey() && getFireworksModel());
}

function stripSecrets(value: string): string {
  return value
    .replace(/fw_[A-Za-z0-9]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/key=[^&\s]+/gi, "key=[redacted]");
}

function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function parseUsage(payload: unknown): FireworksUsage | undefined {
  if (!payload || typeof payload !== "object" || !("usage" in payload)) {
    return undefined;
  }

  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return undefined;

  const promptTokens =
    typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const completionTokens =
    typeof usage.completion_tokens === "number"
      ? usage.completion_tokens
      : undefined;
  const totalTokens =
    typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

function extractChatText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("choices" in payload)) {
    return "";
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";

  const first = choices[0];
  if (!first || typeof first !== "object") return "";

  const message = (first as { message?: { content?: unknown } }).message;
  if (message && typeof message.content === "string") {
    return stripReasoning(message.content);
  }

  const text = (first as { text?: unknown }).text;
  return typeof text === "string" ? stripReasoning(text) : "";
}

function extractCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("choices" in payload)) {
    return "";
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";

  const first = choices[0];
  if (!first || typeof first !== "object") return "";

  const text = (first as { text?: unknown }).text;
  return typeof text === "string" ? stripReasoning(text) : "";
}

function payloadErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Fireworks request failed.";

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Fireworks request failed.";
}

export function sanitizeFireworksError(error: unknown): FireworksError {
  if (error instanceof FireworksError) return error;

  const raw = error instanceof Error ? error.message : "Fireworks request failed.";
  const message = stripSecrets(raw);
  const lower = message.toLowerCase();
  const status =
    error && typeof error === "object" && "status" in error
      ? typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined
      : undefined;

  if (
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return new FireworksError(
      "The writing request took too long and was stopped.",
      "TIMEOUT",
      504,
    );
  }

  if (status === 401 || status === 403 || lower.includes("unauthorized")) {
    return new FireworksError(
      "The writing service could not be authorized.",
      "UNAUTHORIZED",
      status ?? 401,
    );
  }

  if (status === 429 || lower.includes("rate limit")) {
    return new FireworksError(
      "The writing service is busy. Please try again in a moment.",
      "RATE_LIMITED",
      429,
    );
  }

  if (status === 404 || lower.includes("not found") || lower.includes("does not exist")) {
    return new FireworksError(
      "The configured writing model is unavailable.",
      "MODEL_NOT_FOUND",
      404,
    );
  }

  return new FireworksError(
    "Fireworks generation failed.",
    "FIREWORKS_ERROR",
    status ?? 502,
  );
}

async function fireworksFetch(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ status: number; payload: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIREWORKS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload: unknown;
    if (rawText) {
      try {
        payload = JSON.parse(rawText) as unknown;
      } catch {
        payload = { error: { message: rawText.slice(0, 300) } };
      }
    }

    return { status: response.status, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new FireworksError(
        "The writing request took too long and was stopped.",
        "TIMEOUT",
        504,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side Fireworks generation. Never call from client code.
 */
export async function generateWithFireworks(
  prompt: string,
  options?: { apiKey?: string; model?: string },
): Promise<FireworksGenerationResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new FireworksError("Prompt cannot be empty.", "EMPTY_PROMPT");
  }

  const apiKey = cleanEnv(options?.apiKey) ?? getFireworksApiKey();
  const model = cleanEnv(options?.model) ?? getFireworksModel();

  if (!apiKey || !model) {
    throw new FireworksError("Fireworks is not configured.", "NOT_CONFIGURED");
  }

  const started = Date.now();

  try {
    const chat = await fireworksFetch(
      FIREWORKS_CHAT_URL,
      {
        model,
        messages: [{ role: "user", content: trimmed }],
        temperature: 0.7,
        max_tokens: FIREWORKS_MAX_TOKENS,
      },
      apiKey,
    );

    if (chat.status === 200) {
      const text = extractChatText(chat.payload);
      if (!text) {
        throw new FireworksError(
          "Fireworks returned an empty response.",
          "EMPTY_RESPONSE",
          502,
        );
      }

      return {
        text,
        model,
        latencyMs: Date.now() - started,
        usage: parseUsage(chat.payload),
      };
    }

    const shouldTryCompletions =
      chat.status === 400 || chat.status === 404 || chat.status === 405;

    if (shouldTryCompletions) {
      const completion = await fireworksFetch(
        FIREWORKS_COMPLETIONS_URL,
        {
          model,
          prompt: trimmed,
          temperature: 0.7,
          max_tokens: FIREWORKS_MAX_TOKENS,
        },
        apiKey,
      );

      if (completion.status === 200) {
        const text = extractCompletionText(completion.payload);
        if (!text) {
          throw new FireworksError(
            "Fireworks returned an empty response.",
            "EMPTY_RESPONSE",
            502,
          );
        }

        return {
          text,
          model,
          latencyMs: Date.now() - started,
          usage: parseUsage(completion.payload),
        };
      }

      throw new FireworksError(
        stripSecrets(payloadErrorMessage(completion.payload)),
        completion.status === 404 ? "MODEL_NOT_FOUND" : "FIREWORKS_ERROR",
        completion.status,
      );
    }

    throw new FireworksError(
      stripSecrets(payloadErrorMessage(chat.payload)),
      chat.status === 401 || chat.status === 403
        ? "UNAUTHORIZED"
        : chat.status === 429
          ? "RATE_LIMITED"
          : chat.status === 404
            ? "MODEL_NOT_FOUND"
            : "FIREWORKS_ERROR",
      chat.status,
    );
  } catch (error) {
    throw sanitizeFireworksError(error);
  }
}
