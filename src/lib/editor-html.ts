export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One flowing document: no paragraph gaps, but keep a space between sentences. */
export function normalizeContinuousProse(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/([.?!])([A-Za-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([,;:])([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function continuousParagraph(text: string): string {
  const body = normalizeContinuousProse(text);
  return body ? `<p>${escapeHtml(body)}</p>` : "<p></p>";
}

export function plainTextToHtml(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return "<p></p>";
  return continuousParagraph(trimmed);
}

export function humanizePlainTextToHtml(text: string): string {
  return continuousParagraph(text);
}

/** Live rewrite: keep unfinished last words, do not polish mid-stream. */
export function streamHumanizeTextToHtml(text: string): string {
  return continuousParagraph(text);
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
