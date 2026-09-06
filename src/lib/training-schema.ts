/**
 * Training contract for Humanize.
 *
 * The 722-pair corpus lives in `data/training_data.jsonl`. Vertex learned
 * the edit ai_text → human_text. At serve time Humanize sends the user's
 * given draft to TOPN1 and never pastes a stored human_text from a topic
 * or ai_text lookup.
 *
 * Column mapping:
 *   ai_text   → JSONL `input`  (or `ai_text`) — training source only
 *   human_text → JSONL `output` (or `human_text`) — training target only
 */
export const TRAINING_DATASET_TABLE = "training_examples";

export type TrainingExampleRecord = {
  id: number;
  ai_text: string;
  human_text: string;
};

export const TRAINING_EXAMPLE_COLUMNS = {
  id: "integer primary key (row index in training_data.jsonl)",
  ai_text: "text not null — stiff draft used as the training input",
  human_text: "text not null — gold rewrite used as the training target",
} as const;

export const DATABASE_MATCH_THRESHOLD = 0.85;
export const TOPIC_MATCH_THRESHOLD = 0.7;

export type HumanizeApiSource = "database" | "model";
