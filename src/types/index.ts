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
  plan: "FREE" | "BASIC" | "PRO" | "ULTRA";
  maxWordsPerRequest: number;
};

export type HumanizeResponse = {
  id?: string;
  output: string;
  wordCount: number;
  creditsCharged: number;
  creditsRemaining: number;
  duplicate: boolean;
};
