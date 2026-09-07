/**
 * Dataset contract for Humanize keyword lookup.
 *
 * Humanize uses `data/wikipedia_750.jsonl` only. It returns the Wikipedia
 * article whose title (or alias) is the same topic as the user's draft.
 * Body words never select a related article. Unmatched drafts are not
 * rewritten and do not fall back to `training_data.jsonl`.
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
