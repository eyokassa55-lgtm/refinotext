/**
 * Dataset contract for Humanize exact-match lookup.
 *
 * The 715-pair corpus lives in `data/training_data.jsonl`. Exact ai_text
 * matches return stored human_text. All other drafts go to the fine-tuned
 * Vertex endpoint. The JSONL is not sent with inference requests.
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
