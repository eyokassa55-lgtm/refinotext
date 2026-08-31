/**
 * Dataset contract for Humanize exact lookup.
 *
 * The 715-pair corpus lives in `data/training_data.jsonl`. At inference the
 * pairs are already in the fine-tuned Vertex endpoint weights. The JSONL is
 * used only for exact ai_text → human_text returns. Neon stores user requests
 * in `humanizations`, not the training pairs.
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
  human_text: "text not null — stored rewrite, returned unchanged on an exact ai_text match",
} as const;

export type HumanizeApiSource = "database" | "model";
