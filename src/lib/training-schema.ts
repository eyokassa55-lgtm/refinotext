/**
 * Dataset contract for Humanize keyword lookup.
 *
 * The 722-pair corpus lives in `data/training_data.jsonl`. Humanize reads the
 * user's draft for a main topic (title, #hashtag, or opening keywords) and
 * returns that row's paired human_text unchanged. It does not require the
 * draft to match ai_text word for word. Unrelated drafts do not generate a
 * new essay.
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
