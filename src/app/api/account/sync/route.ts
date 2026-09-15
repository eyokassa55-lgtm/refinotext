import { NextResponse } from "next/server";

import { isClerkEnabled } from "@/lib/auth-config";
import { ensureCurrentUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

export async function POST() {
  if (!isClerkEnabled) {
    return errorResponse(
      "Authentication is not configured on this deployment.",
      "AUTH_DISABLED",
      503,
    );
  }

  try {
    const user = await ensureCurrentUser();
    if (!user) {
      return errorResponse("Sign in required", "UNAUTHORIZED", 401);
    }

    return NextResponse.json({
      ok: true,
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error("[account/sync] failed", error);
    return errorResponse("Could not sync account", "USER_SYNC_FAILED", 500);
  }
}
