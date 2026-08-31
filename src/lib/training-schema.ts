/**
 * Dataset contract for Humanize lookup.
 *
 * The 715-pair corpus lives in `data/training_data.jsonl` and is indexed in
 * memory. Exact and same-draft hits return stored human_text. New drafts go
 * to the fine-tuned Vertex endpoint. Neon stores user requests, not pairs.
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
  ai_text: "text not null — original AI draft used as the lookup key",
  human_text:
    "text not null — stored rewrite; returned unchanged on an exact or near-exact hit",
} as const;

export const DATABASE_MATCH_THRESHOLD = 0.85;

export type HumanizeApiSource = "database" | "model";
