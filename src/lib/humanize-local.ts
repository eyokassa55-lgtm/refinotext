import { scrubAiEssayMarks } from "@/lib/humanize-voice";
import { formatEssayParagraphs } from "@/lib/humanize-output";

/**
 * Offline rewrite: edits the user's own draft with phrase-level humanization.
 * No Gemini/Vertex/Wikipedia model calls — keeps every name, number, and claim.
 */

const PHRASE_SWAPS: Array<[RegExp, string]> = [
  [/\bI am writing to request\b/gi, "I am requesting"],
  [/\bI would appreciate it if you could\b/gi, "Could you please"],
  [/\bPlease let me know if you need any additional information from me to complete the process\b/gi, "Let me know if you need anything else from me"],
  [/\bI look forward to your response\b/gi, "I look forward to hearing from you"],
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bat this point in time\b/gi, "now"],
  [/\bfor the purpose of\b/gi, "to"],
  [/\bit is important to note that\b/gi, ""],
  [/\bI am writing (?:this )?(?:email|message )?to\b/gi, "I want to"],
  [/\bI hope this (?:email|message) finds you well\.?\s*/gi, ""],
  [/\bAs (?:an )?AI(?: language model)?[,.]?\s*/gi, ""],
  [/\butilize\b/gi, "use"],
  [/\butilization\b/gi, "use"],
  [/\bfacilitate\b/gi, "help"],
  [/\bleverage\b/gi, "use"],
  [/\bcommence\b/gi, "start"],
  [/\bterminate\b/gi, "end"],
  [/\bassist you with\b/gi, "help with"],
  [/\bprovide assistance\b/gi, "help"],
  [/\bmake a decision\b/gi, "decide"],
  [/\bin the event that\b/gi, "if"],
  [/\bprior to\b/gi, "before"],
  [/\bsubsequent to\b/gi, "after"],
  [/\ba large number of\b/gi, "many"],
  [/\ba significant amount of\b/gi, "a lot of"],
  [/\bwith regard to\b/gi, "about"],
  [/\bregarding the matter of\b/gi, "about"],
  [/\bprocess the refund as soon as possible\b/gi, "process the refund soon"],
  [/\breview my request and process\b/gi, "review this and process"],
];

function rewriteSentence(sentence: string): string {
  let out = sentence.trim();
  if (!out) return out;

  for (const [pattern, replacement] of PHRASE_SWAPS) {
    out = out.replace(pattern, replacement);
  }

  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();

  // Soft opening variety for stiff formal starts.
  out = out
    .replace(/^Hello,\s*/i, "Hi,\n\n")
    .replace(/^Dear Sir or Madam,\s*/i, "Hello,\n\n")
    .replace(/^To Whom It May Concern,\s*/i, "Hello,\n\n");

  if (out && /^[a-z]/.test(out)) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

function rewriteParagraph(paragraph: string): string {
  const parts =
    paragraph
      .match(/[^.!?]+[.!?]+(?:["”']\s*|\s+|$)|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [paragraph];

  return parts.map(rewriteSentence).join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Local humanize of the pasted draft. Same topic and facts; clearer wording.
 */
export function humanizeLocally(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";

  const scrubbed = scrubAiEssayMarks(trimmed);
  const blocks = scrubbed
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[ \t]*\n[ \t]*/g, " ").trim())
    .filter(Boolean)
    .map(rewriteParagraph);

  let output = blocks.join("\n\n");
  output = formatEssayParagraphs(output);

  // Guarantee visible change for short stiff emails even if few swaps fired.
  if (output === scrubbed || output === trimmed) {
    output = output
      .replace(/\bI would appreciate it if you could\b/gi, "Please")
      .replace(/\bas soon as possible\b/gi, "soon")
      .replace(/\badditional information\b/gi, "more details");
    output = formatEssayParagraphs(output);
  }

  return output.trim();
}
