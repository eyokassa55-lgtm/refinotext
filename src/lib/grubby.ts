import "server-only";

import { countWords } from "@/lib/words";

/** Official Grubby MCP HTTP URL from Grubby's Cursor connector. */
export const GRUBBY_MCP_URL = "https://grubby.ai/api/mcp";

/** Observed from Grubby check_quota: min_words_per_request / max_words_per_request. */
export const GRUBBY_MIN_WORDS = 25;
export const GRUBBY_MAX_WORDS = 2500;

const GRUBBY_TIMEOUT_MS = 55_000;
const GRUBBY_POLL_MS = 2_000;
const GRUBBY_REWRITE_MODE = "academic";

export class GrubbyError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "GrubbyError";
    this.code = code;
    this.status = status;
  }
}

export type GrubbyHumanizePayload =
  | { kind: "text"; text: string }
  | { kind: "job"; jobId: string }
  | { kind: "processing" }
  | { kind: "error"; message: string };

function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");
  return cleaned ? cleaned : undefined;
}

function getGrubbyApiKey(): string | undefined {
  return cleanEnv(process.env.GRUBBY_API_KEY);
}

export function isGrubbyConfigured(): boolean {
  return Boolean(getGrubbyApiKey());
}

function requireGrubbyApiKey(): string {
  const key = getGrubbyApiKey();
  if (!key) {
    throw new GrubbyError(
      "The writing service is not configured. Please try again later.",
      "MISSING_GRUBBY_CONFIG",
      503,
    );
  }
  return key;
}

function stripSecrets(value: string): string {
  return value
    .replace(/gmcp_[A-Za-z0-9._-]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/GRUBBY_API_KEY[=:][^\s]+/gi, "GRUBBY_API_KEY=[redacted]");
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseSseJsonRpcMessages(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = tryParseJson(trimmed);
    return parsed === undefined ? [] : [parsed];
  }

  const messages: unknown[] = [];
  for (const block of trimmed.split(/\r?\n\r?\n/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) continue;
    const payload = dataLines.join("\n");
    if (!payload || payload === "[DONE]") continue;
    const parsed = tryParseJson(payload);
    if (parsed !== undefined) messages.push(parsed);
  }
  return messages;
}

function rpcErrorMessage(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const error = asRecord(record.error);
  if (!error) return undefined;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  return "The writing service returned an error.";
}

function toolContentText(message: unknown): string {
  const record = asRecord(message);
  const result = asRecord(record?.result);
  if (!result) return "";

  const structured = asRecord(result.structuredContent);
  if (structured) {
    const structuredText = firstString(structured, [
      "text",
      "output",
      "humanized_text",
      "humanizedText",
      "result",
    ]);
    if (structuredText) return structuredText;
    const jobId = firstString(structured, ["job_id", "jobId"]);
    if (jobId) return JSON.stringify(structured);
  }

  const content = result.content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    const part = asRecord(item);
    if (part && typeof part.text === "string") parts.push(part.text);
  }
  return parts.join("\n").trim();
}

function isToolError(message: unknown): boolean {
  const record = asRecord(message);
  const result = asRecord(record?.result);
  return result?.isError === true;
}

export function extractGrubbyHumanizePayload(raw: string): GrubbyHumanizePayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "error", message: "The writing service returned an empty response." };
  }

  const parsed = tryParseJson(trimmed);
  const record = asRecord(parsed);
  if (record) {
    const status = String(record.status ?? "").toLowerCase();
    if (status === "failed" || status === "error") {
      return {
        kind: "error",
        message:
          firstString(record, ["message", "error", "detail"]) ??
          "Humanization failed. Please try again.",
      };
    }
    if (status === "processing" || status === "pending" || status === "queued" || status === "running") {
      const jobId = firstString(record, ["job_id", "jobId"]);
      return jobId ? { kind: "job", jobId } : { kind: "processing" };
    }

    const text = firstString(record, [
      "text",
      "output",
      "humanized_text",
      "humanizedText",
      "result",
    ]);
    if (text) return { kind: "text", text };

    const jobId = firstString(record, ["job_id", "jobId"]);
    if (jobId) return { kind: "job", jobId };
  }

  return { kind: "text", text: trimmed };
}

function userFacingGrubbyMessage(raw: string, fallback: string): { message: string; code: string; status: number } {
  const message = stripSecrets(raw).trim() || fallback;
  const lower = message.toLowerCase();

  if (lower.includes("quota") || lower.includes("insufficient") || lower.includes("out of words")) {
    return {
      message: "The writing service is out of capacity right now. Please try again later.",
      code: "GRUBBY_QUOTA",
      status: 429,
    };
  }
  if (lower.includes("too short") || lower.includes("min_words") || lower.includes("at least 25")) {
    return {
      message: `Add a bit more text (at least ${GRUBBY_MIN_WORDS} words) before humanizing.`,
      code: "TEXT_TOO_SHORT",
      status: 400,
    };
  }
  if (lower.includes("too long") || lower.includes("max_words") || lower.includes("2500")) {
    return {
      message: `This draft is too long for a single Humanize request (max ${GRUBBY_MAX_WORDS.toLocaleString()} words).`,
      code: "GRUBBY_LIMIT",
      status: 400,
    };
  }
  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("invalid api")) {
    return {
      message: "The writing service is not available right now. Please try again later.",
      code: "UNAUTHORIZED",
      status: 502,
    };
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return {
      message: "The writing service is busy. Please wait a moment and try again.",
      code: "RATE_LIMITED",
      status: 429,
    };
  }

  return { message: fallback, code: "HUMANIZATION_FAILED", status: 502 };
}

async function mcpCall(name: string, args: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const key = requireGrubbyApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GRUBBY_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      const mapped = userFacingGrubbyMessage(raw, "Humanization failed. Please try again.");
      throw new GrubbyError(mapped.message, mapped.code, response.status >= 400 ? mapped.status : 502);
    }

    const messages = parseSseJsonRpcMessages(raw);
    if (!messages.length) {
      throw new GrubbyError(
        "The writing service returned an empty response.",
        "EMPTY_RESPONSE",
        502,
      );
    }

    const last = messages[messages.length - 1];
    const rpcError = rpcErrorMessage(last);
    if (rpcError || isToolError(last)) {
      const mapped = userFacingGrubbyMessage(
        rpcError || toolContentText(last),
        "Humanization failed. Please try again.",
      );
      throw new GrubbyError(mapped.message, mapped.code, mapped.status);
    }

    const text = toolContentText(last);
    if (!text) {
      throw new GrubbyError(
        "The writing service returned an empty response.",
        "EMPTY_RESPONSE",
        502,
      );
    }
    return text;
  } catch (error) {
    if (error instanceof GrubbyError) throw error;
    const lower = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) ||
      lower.includes("timeout") ||
      lower.includes("aborted")
    ) {
      throw new GrubbyError(
        "The writing request took too long and was stopped. Please try again.",
        "TIMEOUT",
        504,
      );
    }
    throw new GrubbyError(
      "Humanization failed. Please try again.",
      "UNAVAILABLE",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

function assertWordLimits(text: string): void {
  const words = countWords(text);
  if (words < GRUBBY_MIN_WORDS) {
    throw new GrubbyError(
      `Add a bit more text (at least ${GRUBBY_MIN_WORDS} words) before humanizing.`,
      "TEXT_TOO_SHORT",
      400,
    );
  }
  if (words > GRUBBY_MAX_WORDS) {
    throw new GrubbyError(
      `This draft is too long for a single Humanize request (max ${GRUBBY_MAX_WORDS.toLocaleString()} words).`,
      "GRUBBY_LIMIT",
      400,
    );
  }
}

async function waitForJob(jobId: string, deadline: number): Promise<string> {
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= GRUBBY_POLL_MS) break;
    await new Promise((resolve) => setTimeout(resolve, GRUBBY_POLL_MS));
    const raw = await mcpCall("get_humanize_result", { job_id: jobId }, Math.max(5_000, remaining));
    const payload = extractGrubbyHumanizePayload(raw);
    if (payload.kind === "text") return payload.text;
    if (payload.kind === "error") {
      const mapped = userFacingGrubbyMessage(payload.message, "Humanization failed. Please try again.");
      throw new GrubbyError(mapped.message, mapped.code, mapped.status);
    }
    if (payload.kind === "job") {
      jobId = payload.jobId;
    }
  }

  throw new GrubbyError(
    "The writing request took too long and was stopped. Please try again.",
    "TIMEOUT",
    504,
  );
}

export async function humanizeWithGrubby(text: string): Promise<string> {
  assertWordLimits(text);
  const deadline = Date.now() + GRUBBY_TIMEOUT_MS;
  const raw = await mcpCall(
    "humanize_text",
    { text, mode: GRUBBY_REWRITE_MODE },
    GRUBBY_TIMEOUT_MS,
  );
  const payload = extractGrubbyHumanizePayload(raw);

  if (payload.kind === "text") return payload.text.trim();
  if (payload.kind === "job") {
    return (await waitForJob(payload.jobId, deadline)).trim();
  }
  if (payload.kind === "error") {
    const mapped = userFacingGrubbyMessage(payload.message, "Humanization failed. Please try again.");
    throw new GrubbyError(mapped.message, mapped.code, mapped.status);
  }

  throw new GrubbyError(
    "The writing service is still working. Please try again in a moment.",
    "TIMEOUT",
    504,
  );
}
