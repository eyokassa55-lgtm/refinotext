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
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\n+/g, " ")
    .replace(/([.?!])([A-Za-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([,;:])([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeDocumentTitle(line: string): boolean {
  const words = line.split(/\s+/).filter(Boolean);
  return (
    words.length >= 1 &&
    words.length <= 20 &&
    !/[.?!]$/.test(line) &&
    !line.includes("\n") &&
    !/linking theory to real[\s-]*world evidence/i.test(line)
  );
}

export function peelDocumentTitle(text: string): { title: string | null; body: string } {
  const trimmed = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) return { title: null, body: "" };

  const hash = trimmed.match(/^#\s+([^\n]+)(?:\n+|$)/);
  if (hash && trimmed.slice(hash[0].length).trim()) {
    return { title: hash[1]!.trim(), body: trimmed.slice(hash[0].length) };
  }

  const firstBreak = trimmed.search(/\n+/);
  if (firstBreak > 0) {
    const firstLine = trimmed.slice(0, firstBreak).trim();
    if (looksLikeDocumentTitle(firstLine)) {
      return { title: firstLine, body: trimmed.slice(firstBreak).trim() };
    }
  }

  return { title: null, body: trimmed };
}

/** Keep a title line, then one continuous body. */
export function formatContinuousDocument(text: string): string {
  const { title, body } = peelDocumentTitle(text);
  const flow = normalizeContinuousProse(body);
  return title ? `${title}\n\n${flow}` : flow;
}

function continuousDocument(text: string, allowTitle: boolean): string {
  const { title, body } = allowTitle ? peelDocumentTitle(text) : { title: null, body: text };
  const flow = normalizeContinuousProse(body);
  const paragraph = flow ? `<p>${escapeHtml(flow)}</p>` : "<p></p>";
  if (allowTitle && title) {
    return `<h1>${escapeHtml(title)}</h1>${paragraph}`;
  }
  return paragraph;
}

export function plainTextToHtml(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return "<p></p>";
  return continuousDocument(trimmed, true);
}

export function humanizePlainTextToHtml(text: string): string {
  return continuousDocument(text, true);
}

/** Live rewrite: keep unfinished last words, do not polish mid-stream. */
export function streamHumanizeTextToHtml(text: string): string {
  return continuousDocument(text, true);
}

/** Saved HTML can still have many <p> blocks — collapse to title + one body. */
export function flattenHtmlToContinuous(html: string): string {
  if (!html.trim()) return "<p></p>";
  const titled = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titled
    ? titled[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : null;
  const body = html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  const next = title ? `${title}\n\n${body}` : body;
  return continuousDocument(next, Boolean(title));
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
