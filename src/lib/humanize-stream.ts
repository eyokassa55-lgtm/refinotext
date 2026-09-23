import type { HumanizeResponse, HumanizeStreamEvent } from "@/types";

export class HumanizeStreamError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "HumanizeStreamError";
    this.code = code;
  }
}

function parseSseEvent(block: string): HumanizeStreamEvent | null {
  const line = block
    .split("\n")
    .map((part) => part.trimEnd())
    .find((part) => part.startsWith("data:"));
  if (!line) return null;
  const payload = line.replace(/^data:\s?/, "");
  if (!payload || payload === "[DONE]") return null;
  return JSON.parse(payload) as HumanizeStreamEvent;
}

export async function readHumanizeSse(
  response: Response,
  onText: (output: string) => void,
): Promise<HumanizeResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new HumanizeStreamError("The humanizer returned an empty response. Please try again.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let done: HumanizeResponse | null = null;
  let streamError: HumanizeStreamError | null = null;

  while (true) {
    const { value, finished } = await readChunk(reader);
    buffer += decoder.decode(value, { stream: !finished });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      let event: HumanizeStreamEvent | null = null;
      try {
        event = parseSseEvent(block);
      } catch {
        continue;
      }
      if (!event) continue;
      if (event.type === "text" && typeof event.output === "string") {
        onText(event.output);
      } else if (event.type === "done") {
        done = {
          id: event.id,
          output: event.output,
          humanizedText: event.humanizedText,
          source: event.source,
          wordCount: event.wordCount,
          creditsCharged: event.creditsCharged,
          creditsRemaining: event.creditsRemaining,
          duplicate: event.duplicate,
        };
      } else if (event.type === "error") {
        streamError = new HumanizeStreamError(event.error, event.code);
      }
    }

    if (finished) break;
  }

  if (streamError) throw streamError;
  if (!done || typeof done.output !== "string") {
    throw new HumanizeStreamError("The humanizer returned an empty response. Please try again.");
  }
  return done;
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{
  value?: Uint8Array;
  finished: boolean;
}> {
  const { value, done } = await reader.read();
  return { value, finished: done };
}

