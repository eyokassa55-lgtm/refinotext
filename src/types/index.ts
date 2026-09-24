export type ApiErrorResponse = {
  error: string;
  code?: string;
};

export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

export type CreditBalanceResponse = {
  balance: number;
  monthlyCredits: number;
  interval: string | null;
  plan: "FREE" | "BASIC" | "PRO" | "ULTRA";
  maxWordsPerRequest: number;
};

export type HumanizeResponse = {
  id?: string;
  output: string;
  humanizedText: string;
  source: "database" | "model";
  wordCount: number;
  creditsCharged: number;
  creditsRemaining: number;
  duplicate: boolean;
};

export type HumanizeStreamEvent =
  | { type: "status"; stage?: string }
  | { type: "text"; output: string }
  | ({ type: "done" } & HumanizeResponse)
  | { type: "error"; error: string; code?: string; output?: string };
