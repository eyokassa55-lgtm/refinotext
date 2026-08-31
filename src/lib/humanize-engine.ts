import "server-only";

import {
  GeminiError,
  generateText,
  hasVertexEndpointEnv,
  isBaseGeminiFallbackEnabled,
  isVertexConfigured,
} from "@/lib/gemini";
import {
  buildEditorSystemInstruction,
  buildRepairSystemInstruction,
} from "@/lib/humanize-prompt";
import {
  assessRewriteQuality,
  isBlockingQualityFailure,
  missingFactsForRetry,
} from "@/lib/humanize-quality";
import { countWords } from "@/lib/words";

export type HumanizeRequest = {
  text: string;
  tone?: string;
  readability?: string;
  intensity?: number;
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

function generationOptions(request: HumanizeRequest) {
  const intensity = request.intensity ?? 75;
  const temperature = 0.38 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.32;
  const words = countWords(request.text);
  return {
    temperature,
    topP: 0.95,
    maxOutputTokens: Math.min(8192, Math.max(256, Math.ceil(words * 2.2) + 160)),
  };
}

function wrapAsError(error: unknown): HumanizationFailedError {
  if (error instanceof GeminiError) {
    return new HumanizationFailedError(error.message, error.code, error.status);
  }

  return new HumanizationFailedError(
    "Humanization failed. Your credits were refunded.",
  );
}

async function rewriteWithModel(
  request: HumanizeRequest,
  systemInstruction: string,
): Promise<string> {
  return generateText(request.text, {
    systemInstruction,
    ...generationOptions(request),
  });
}

function finalizeOutput(input: string, raw: string): string {
  const quality = assessRewriteQuality(input, raw);
  if (quality.ok) return quality.output;

  if (isBlockingQualityFailure(quality) || !quality.output) {
    console.error("[humanize] quality check failed", {
      codes: quality.issues.map((issue) => issue.code),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  if (quality.issues.some((issue) => issue.code === "TOO_SHORT" || issue.code.startsWith("MISSING"))) {
    console.error("[humanize] quality check failed", {
      codes: quality.issues.map((issue) => issue.code),
    });
    throw new HumanizationFailedError(
      "Humanization failed. Please try again.",
      "QUALITY_CHECK_FAILED",
      502,
    );
  }

  return quality.output;
}

export async function runHumanization(request: HumanizeRequest): Promise<string> {
  if (hasVertexEndpointEnv() || isVertexConfigured()) {
    try {
      const first = await rewriteWithModel(
        request,
        buildEditorSystemInstruction(request),
      );
      const firstQuality = assessRewriteQuality(request.text, first);
      if (firstQuality.ok) return firstQuality.output;

      console.info("[humanize] retrying once after quality check", {
        codes: firstQuality.issues.map((issue) => issue.code),
      });

      const repaired = await rewriteWithModel(
        request,
        buildRepairSystemInstruction(
          request,
          missingFactsForRetry(request.text, firstQuality.output || first),
        ),
      );
      return finalizeOutput(request.text, repaired);
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  if (isBaseGeminiFallbackEnabled()) {
    try {
      const text = await rewriteWithModel(
        request,
        buildEditorSystemInstruction(request),
      );
      return finalizeOutput(request.text, text);
    } catch (error) {
      if (error instanceof HumanizationFailedError) throw error;
      throw wrapAsError(error);
    }
  }

  console.error(
    "[humanize] Vertex AI tuned endpoint is not configured; refusing base Gemini",
  );
  throw new HumanizationFailedError(
    "The writing service is not configured. Please try again later.",
    "MISSING_VERTEX_CONFIG",
    503,
  );
}
