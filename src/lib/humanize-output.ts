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

function toParagraphs(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[ \t]*\n[ \t]*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length >= 2) return blocks;

  const block = blocks[0];
  if (!block) return [];
  return splitLongBlock(block);
}

function splitLongBlock(block: string): string[] {
  const sentences = block.match(/[^.!?]+[.!?]+(?:["”']\s*|\s+|$)/g);
  if (!sentences || sentences.length < 3) return [block];

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
  return paragraphs.length > 0 ? paragraphs : [block];
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

function polishProse(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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
  if (text.length <= maxChars) return endOnCompleteSentence(text);
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
 * Wikipedia article text for the editor: exact title, then paragraphs.
 * Wiki sub-topic headings are removed so the piece ends as finished prose.
 */
export function formatWikipediaEditorText(
  title: string,
  extract: string,
  maxChars = 2400,
): string {
  const heading = title.replace(/^#+\s*/, "").trim();
  const cleaned = polishProse(stripNavAndHeadings(extract));
  const paragraphs = toParagraphs(cleaned);
  const body = clipToBudget(paragraphs.join("\n\n"), maxChars);
  if (!heading || body.length < 80) return body;
  return `# ${heading}\n\n${body}`;
}
