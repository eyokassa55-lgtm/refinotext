import { NextResponse } from "next/server";

import { isClerkEnabled } from "@/lib/auth-config";
import { getCreditBalance } from "@/lib/credits";
import { ensureCurrentUser } from "@/lib/users";
import type { ApiErrorResponse, CreditBalanceResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

export async function GET() {
  if (!isClerkEnabled) {
    return errorResponse(
      "Authentication is not configured on this deployment.",
      "AUTH_DISABLED",
      503,
    );
  }

  const user = await ensureCurrentUser();
  if (!user) {
    return errorResponse("Sign in required to view credits", "UNAUTHORIZED", 401);
  }

  const account = await getCreditBalance(user.id);
  if (!account) {
    return errorResponse("No credit account found", "NO_ACCOUNT", 404);
  }

  const response: CreditBalanceResponse = {
    balance: account.balance,
    monthlyCredits: account.monthlyCredits,
    plan: account.plan,
    maxWordsPerRequest: account.maxWordsPerRequest,
  };

  return NextResponse.json(response);
}
