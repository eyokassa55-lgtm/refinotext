/** Typical Wikipedia back-matter and section labels — never shown as extra sub-topics. */
const NAV_OR_SECTION_LINE =
  /^(?:={2,}\s*.+?\s*={2,}|see also|references|external links|further reading|notes|bibliography|citations|sources|contents|etymology|terminology|classification|gallery|footnotes|references and notes|history|overview|types|applications|description|background|origins|development|usage|definition|examples|characteristics|variants)$/i;

export function extractUserTitle(text: string): string | null {
  const first = text
    .trim()
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return null;
  const heading = first
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
  const words = heading.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 20 && !/[.?!]$/.test(heading)) {
    return heading;
  }
  return null;
}

export function applyInputTitle(output: string, input: string): string {
  const body = output.replace(/^#\s+[^\n]+\n*/, "").trim();
  const title = extractUserTitle(input);
  if (!title) return body;
  return `${title}\n\n${body}`;
}

export function splitHumanizeOutput(text: string): {
  title: string | null;
  paragraphs: string[];
} {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { title: null, paragraphs: [] };

  const hash = trimmed.match(/^#\s+([^\n]+)\n+/);
  if (hash) {
    return {
      title: hash[1]!.trim(),
      paragraphs: toParagraphs(trimmed.slice(hash[0].length)),
    };
  }

  const firstBreak = trimmed.indexOf("\n\n");
  if (firstBreak > 0) {
    const firstLine = trimmed.slice(0, firstBreak).trim();
    const words = firstLine.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 20 && !/[.?!]$/.test(firstLine) && !firstLine.includes("\n")) {
      return {
        title: firstLine,
        paragraphs: toParagraphs(trimmed.slice(firstBreak + 2)),
      };
    }
  }

  return { title: null, paragraphs: toParagraphs(trimmed) };
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/[.!?…]["”']?$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function toParagraphs(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[ \t]*\n[ \t]*/g, " ").replace(/\s+/g, " ").trim())
    .filter((block) => Boolean(block) && !isBrokenSentence(block))
    .map(ensureTerminalPunctuation);
  if (blocks.length >= 2) return blocks;

  const block = blocks[0];
  if (!block) return [];
  return splitLongBlock(block).map(ensureTerminalPunctuation);
}

/** Essay body: blank-line paragraphs, cleaned spacing, terminal punctuation. */
export function formatEssayParagraphs(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return "";

  const hash = trimmed.match(/^#\s+([^\n]+)\n+/);
  if (hash) {
    const title = hash[1]!.trim();
    const body = toParagraphs(trimmed.slice(hash[0].length)).join("\n\n");
    return body ? `# ${title}\n\n${body}` : `# ${title}`;
  }

  const firstBreak = trimmed.indexOf("\n\n");
  if (firstBreak > 0) {
    const firstLine = trimmed.slice(0, firstBreak).trim();
    const words = firstLine.split(/\s+/).filter(Boolean);
    // Only peel one plain title line; do not treat body openings as titles.
    if (words.length >= 1 && words.length <= 20 && !/[.?!]$/.test(firstLine) && !firstLine.includes("\n")) {
      const body = toParagraphs(trimmed.slice(firstBreak + 2)).join("\n\n");
      return body ? `${firstLine}\n\n${body}` : firstLine;
    }
  }

  return toParagraphs(trimmed).join("\n\n");
}

function dropUnclosedParens(text: string): string {
  const lastOpen = text.lastIndexOf("(");
  const lastClose = text.lastIndexOf(")");
  if (lastOpen > lastClose) {
    const before = text.slice(0, lastOpen).replace(/[ ,;:]+$/g, "").trim();
    if (!before) return "";
    return /[.!?]$/.test(before) ? before : `${before}.`;
  }
  return text.trim();
}

function isBrokenSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return true;
  if (/^[,);:]/.test(trimmed)) return true;
  if (/^[eg]\.\s/i.test(trimmed)) return true;
  if (/^[a-z]/.test(trimmed)) return true;
  return false;
}

function splitLongBlock(block: string): string[] {
  const sentences = (block.match(/[^.!?]+[.!?]+(?:["”']\s*|\s+|$)/g) ?? [block])
    .map((sentence) => dropUnclosedParens(sentence.replace(/\s+/g, " ").trim()))
    .filter((sentence) => sentence && !isBrokenSentence(sentence));
  if (sentences.length === 0) return [];
  if (sentences.length < 3) return [sentences.join(" ")];

  const paragraphs: string[] = [];
  let buffer = "";
  let count = 0;
  for (const sentence of sentences) {
    buffer += sentence.trim() + " ";
    count += 1;
    if (count >= 2 && buffer.trim().length >= 160) {
      paragraphs.push(buffer.trim());
      buffer = "";
      count = 0;
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());
  return paragraphs.length > 0 ? paragraphs : [sentences.join(" ")];
}

function stripNavAndHeadings(text: string): string {
  const markers = [
    /\nSee also\n/i,
    /\nReferences\n/i,
    /\nExternal links\n/i,
    /\nFurther reading\n/i,
    /\nNotes\n/i,
    /\nBibliography\n/i,
  ];
  let out = text.replace(/\r\n/g, "\n").trim();
  for (const marker of markers) {
    const index = out.search(marker);
    if (index >= 80) out = out.slice(0, index).trim();
  }

  const kept: string[] = [];
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push("");
      continue;
    }
    if (NAV_OR_SECTION_LINE.test(trimmed)) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function matchBalancedBrace(text: string, openIndex: number): number {
  if (text[openIndex] !== "{") return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function latexToPlain(inner: string): string {
  let text = inner.replace(/^\\(?:displaystyle|textstyle|scriptstyle)\s*/, "");
  const replacements: Array<[RegExp, string]> = [
    [/\\varphi\b|\\phi\b/g, "φ"],
    [/\\ell\b/g, "ℓ"],
    [/\\lnot\b|\\neg\b/g, "¬"],
    [/\\not\s*/g, "¬"],
    [/\\in\b/g, "∈"],
    [/\\langle\b/g, "⟨"],
    [/\\rangle\b/g, "⟩"],
    [/\\leq\b/g, "≤"],
    [/\\geq\b/g, "≥"],
    [/\\neq\b|\\ne\b/g, "≠"],
    [/\\times\b/g, "×"],
    [/\\cdot\b/g, "·"],
    [/\\infty\b/g, "∞"],
    [/\\forall\b/g, "∀"],
    [/\\exists\b/g, "∃"],
    [/\\subseteq\b/g, "⊆"],
    [/\\subset\b/g, "⊂"],
    [/\\emptyset\b|\\varnothing\b/g, "∅"],
    [/\\rightarrow\b|\\to\b/g, "→"],
    [/\\Rightarrow\b/g, "⇒"],
    [/\\leftrightarrow\b/g, "↔"],
    [/\\land\b|\\wedge\b/g, "∧"],
    [/\\lor\b|\\vee\b/g, "∨"],
    [/\\alpha\b/g, "α"],
    [/\\beta\b/g, "β"],
    [/\\gamma\b/g, "γ"],
    [/\\delta\b/g, "δ"],
    [/\\theta\b/g, "θ"],
    [/\\lambda\b/g, "λ"],
    [/\\mu\b/g, "μ"],
    [/\\pi\b/g, "π"],
    [/\\sigma\b/g, "σ"],
    [/\\omega\b/g, "ω"],
    [/\\mathbb\{([^}]+)\}/g, "$1"],
    [/\\mathrm\{([^}]+)\}/g, "$1"],
    [/\\operatorname\{([^}]+)\}/g, "$1"],
    [/\\text\{([^}]+)\}/g, "$1"],
    [/\\mathbf\{([^}]+)\}/g, "$1"],
    [/\\mathit\{([^}]+)\}/g, "$1"],
    [/\\overline\{([^}]+)\}/g, "$1"],
    [/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2"],
    [/\\left\b|\\right\b/g, ""],
    [/\\,|\\;|\\!|\\quad|\\qquad|\\ /g, " "],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMathPreviewLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length > 48) return false;
  if (/\{\\(?:display|text|script)style\b/.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.some((word) => /^[A-Za-z]{3,}$/.test(word))) return false;
  return words.length <= 4;
}

function rewindMathPreview(prefix: string): number {
  const lines = prefix.split("\n");
  let cut = lines.length;
  while (cut > 0 && isMathPreviewLine(lines[cut - 1]!)) {
    cut -= 1;
  }
  return lines.slice(0, cut).join("\n").length;
}

/** Remove Wikipedia plaintext math dumps such as `{\displaystyle A}` and the duplicate layout above them. */
export function stripWikiMath(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  out = out.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, " ");

  const markers = /\{\s*\\(?:displaystyle|textstyle|scriptstyle)\b/;
  for (let guard = 0; guard < 500; guard += 1) {
    const found = out.match(markers);
    if (!found || found.index === undefined) break;
    const start = found.index;
    const close = matchBalancedBrace(out, start);
    if (close < 0) {
      out = out.slice(0, start) + out.slice(start + 1);
      continue;
    }
    const plain = latexToPlain(out.slice(start + 1, close));
    const from = rewindMathPreview(out.slice(0, start));
    out = `${out.slice(0, from)} ${plain ? `${plain} ` : ""}${out.slice(close + 1)}`;
  }

  return scrubLatexDump(
    out
      .replace(/\\[a-zA-Z]+\*?/g, "")
      .replace(/\{\s*\}/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/^[, \t"“”]+/gm, "")
      .replace(/,\s*,+/g, ",")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[^\S\n]{2,}/g, " ")
      .trim(),
  );
}

export function hasLatexDump(text: string): boolean {
  return /\\(?:displaystyle|textstyle|scriptstyle)\b|\{\s*\\[a-zA-Z]/i.test(text);
}

function scrubLatexDump(text: string): string {
  let out = text;
  for (let i = 0; i < 8; i += 1) {
    const next = out
      .replace(/\{\s*\\(?:displaystyle|textstyle|scriptstyle)\b[^}]*\}/gi, " ")
      .replace(/\\(?:displaystyle|textstyle|scriptstyle)\b/gi, "")
      .replace(/\{\s*\\[a-zA-Z]+[^}]*\}/g, " ")
      .replace(/\\[a-zA-Z]+\*?/g, " ")
      .replace(/[^\S\n]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function repairExtractGaps(text: string): string {
  return text
    .replace(/⟨\s+/g, "⟨")
    .replace(/\s+⟩/g, "⟩")
    .replace(/¬\s+/g, "¬")
    .replace(/,\s+(?![A-Z])[^()<>.]{8,220}\)/g, "")
    .replace(/\(\s*(?:i\.e\.|e\.g\.|viz\.)?\s*\)/gi, "")
    .replace(/\(\s*,/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .replace(/(^|[.!?]\s+),\s+/g, "$1")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

function polishProse(text: string): string {
  return repairExtractGaps(stripWikiMath(text))
    .replace(/\[\d+\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(^|\n),\s*/g, "$1")
    .trim();
}

function endOnCompleteSentence(text: string): string {
  const trimmed = text.trim();
  if (/[.!?]["”']?$/.test(trimmed)) return trimmed;
  const last = Math.max(trimmed.lastIndexOf(". "), trimmed.lastIndexOf("? "), trimmed.lastIndexOf("! "));
  if (last >= 200) return trimmed.slice(0, last + 1).trim();
  return trimmed;
}

function clipToBudget(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return endOnCompleteSentence(text);
  const slice = text.slice(0, maxChars);
  const paragraph = slice.lastIndexOf("\n\n");
  const sentence = slice.lastIndexOf(". ");
  const cut = Math.max(paragraph, sentence);
  if (cut >= 400) {
    return endOnCompleteSentence(slice.slice(0, sentence === cut ? cut + 1 : cut));
  }
  return endOnCompleteSentence(slice);
}

/**
 * Wikipedia article text for the editor: title, then full essay paragraphs.
 * Sub-topic headings are removed. Content is not truncated unless maxChars > 0.
 */
export function formatWikipediaEditorText(
  title: string,
  extract: string,
  maxChars = 0,
): string {
  const heading = title.replace(/^#+\s*/, "").trim();
  const cleaned = polishProse(stripNavAndHeadings(extract));
  let body = formatEssayParagraphs(cleaned);
  if (maxChars > 0) body = clipToBudget(body, maxChars);
  body = scrubLatexDump(body);
  if (hasLatexDump(body)) body = scrubLatexDump(stripWikiMath(body));
  body = formatEssayParagraphs(body);
  if (!heading || body.length < 80) return body;
  return `# ${heading}\n\n${body}`;
}
