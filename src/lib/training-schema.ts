/**
 * Dataset contract for Humanize keyword lookup.
 *
 * The 722-pair corpus lives in `data/training_data.jsonl`. Humanize reads
 * topic keywords from the user's draft (a title, optional #hashtag, or
 * opening words) and matches them against every stored ai_text. The first
 * pair for that same topic is returned with its human_text unchanged. A
 * hashtag is not required. This same-topic rule applies to every stored pair:
 * a narrower or related subject does not replace the user's meaning
 * (History vs American History, intelligence vs artificial intelligence).
 * Unmatched drafts are rewritten by the human_text-trained Vertex model
 * (or a publisher Gemini model until that job is bound).
 *
 * Column mapping:
 *   ai_text   → JSONL `input`  (or `ai_text`)
 *   human_text → JSONL `output` (or `human_text`)
 */
export const TRAINING_DATASET_TABLE = "training_examples";

export type TrainingExampleRecord = {
  id: number;
  ai_text: string;
  human_text: string;
};

export const TRAINING_EXAMPLE_COLUMNS = {
  id: "integer primary key (row index in training_data.jsonl)",
  ai_text: "text not null — original AI draft used as the exact lookup key",
  human_text: "text not null — stored rewrite; returned unchanged on an exact hit",
} as const;

export const DATABASE_MATCH_THRESHOLD = 0.85;
export const TOPIC_MATCH_THRESHOLD = 0.7;

export type HumanizeApiSource = "database" | "model";
