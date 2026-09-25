import { splitHumanizeOutput } from "@/lib/humanize-output";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function continuousParagraph(text: string): string {
  return `<p>${escapeHtml(text.replace(/\n{2,}/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ").trim())}</p>`;
}

export function plainTextToHtml(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return "<p></p>";
  return continuousParagraph(trimmed);
}

export function humanizePlainTextToHtml(text: string): string {
  const { title, paragraphs } = splitHumanizeOutput(text);
  const body = paragraphs.join(" ").replace(/\s+/g, " ").trim();
  const parts: string[] = [];
  if (title) parts.push(`<h1>${escapeHtml(title)}</h1>`);
  if (body) parts.push(continuousParagraph(body));
  return parts.join("") || "<p></p>";
}

/** Live rewrite: keep unfinished last words, do not polish mid-stream. */
export function streamHumanizeTextToHtml(text: string): string {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return "<p></p>";

  const firstBreak = normalized.indexOf("\n\n");
  if (firstBreak > 0) {
    const firstLine = normalized.slice(0, firstBreak).trim();
    const words = firstLine.split(/\s+/).filter(Boolean);
    if (
      words.length >= 1 &&
      words.length <= 20 &&
      !/[.?!]$/.test(firstLine) &&
      !firstLine.includes("\n")
    ) {
      const rest = normalized
        .slice(firstBreak + 2)
        .replace(/\n{2,}/g, " ")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `<h1>${escapeHtml(firstLine)}</h1>${rest ? continuousParagraph(rest) : "<p></p>"}`;
    }
  }

  return plainTextToHtml(normalized);
}

export function sanitizeEditorUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function previewPlainText(text: string, max = 80): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}
