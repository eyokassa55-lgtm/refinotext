import "server-only";

import { GeminiError, generateText } from "@/lib/gemini";

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

function formatTone(tone?: string): string {
  if (!tone) return "natural";
  return tone.replace(/[-_]/g, " ");
}

function buildHumanizePrompt(request: HumanizeRequest): string {
  const tone = formatTone(request.tone);
  const readability = request.readability ?? "General Audience";
  const intensity = request.intensity ?? 75;

  return `You are a careful writing editor for RefinoText.

Rewrite the user's text to sound more natural, clear, and human-written.

Rules:
- Preserve the original meaning, facts, names, numbers, dates, links, citations, and intent.
- Do not invent claims, examples, statistics, sources, links, or citations.
- Do not remove important details.
- Improve grammar, clarity, flow, sentence rhythm, and readability.
- Do not optimize for bypassing AI detectors.
- Return only the rewritten text. Do not add explanations, labels, markdown fences, or notes.

Requested tone: ${tone}
Target readability: ${readability}
Rewrite strength: ${intensity}/100

Text to rewrite:
${request.text}`;
}

export async function runHumanization(request: HumanizeRequest): Promise<string> {
  try {
    return await generateText(buildHumanizePrompt(request));
  } catch (error) {
    if (error instanceof GeminiError) {
      throw new HumanizationFailedError(error.message, error.code, error.status);
    }

    throw new HumanizationFailedError(
      "Humanization failed. Your credits were refunded.",
    );
  }
}
