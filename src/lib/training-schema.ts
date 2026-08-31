/**
 * Dataset contract for Humanize lookup.
 *
 * The 715-pair corpus lives in `data/training_data.jsonl` and is indexed in
 * memory (TF-IDF vectors + inverted index). That index is the pgvector
 * equivalent: search `ai_text`, retrieve `human_text`. Neon stores user
 * requests in `humanizations`, not the training pairs.
 *
 * Column mapping:
 *   ai_text   → JSONL `input`  (or `ai_text`)
 *   human_text → JSONL `output` (or `human_text`)
 *
 * Equivalent Postgres/pgvector lookup if the JSONL were loaded into a table:
 *   SELECT human_text, 1 - (ai_embedding <=> $query) AS score
 *   FROM training_examples
 *   WHERE 1 - (ai_embedding <=> $query) >= 0.85
 *   ORDER BY ai_embedding <=> $query
 *   LIMIT 1;
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
    "text not null — stored rewrite; returned unchanged on an exact/same-entity hit, or used as the wording template for entity merge",
} as const;

export const DATABASE_MATCH_THRESHOLD = 0.85;

export type HumanizeApiSource = "database" | "model";
