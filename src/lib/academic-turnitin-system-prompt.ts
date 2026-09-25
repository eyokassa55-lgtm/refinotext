import { HUMANIZER_SYSTEM_PROMPT } from "@/lib/humanizer-system-prompt";

/**
 * Academic (Turnitin) uses the GPTZero system prompt unchanged,
 * except for a preserve-meaning rule.
 */
export const ACADEMIC_TURNITIN_SYSTEM_PROMPT = HUMANIZER_SYSTEM_PROMPT.replace(
  "Do not add new ideas, facts, sources or examples.",
  `PRESERVE MEANING. Style may change. Meaning may not.
Keep the user's original meaning, intent, topic, and first-paragraph point. Do not replace the user's meaning with a new title, a new claim, or a different subject.
Do not add new ideas, facts, sources or examples.`,
).replace(
  "- Style from the sample. Topic, names, dates, numbers and meaning from the user.",
  "- Style from the sample. Topic, names, dates, numbers and meaning from the user.\n- Preserve the original meaning exactly. Do not change what the user is saying.",
);
