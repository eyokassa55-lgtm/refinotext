import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { isClerkEnabled } from "@/lib/auth-config";
import {
  buildRequestId,
  checkCredits,
  CreditError,
  saveHumanizationAndCharge,
} from "@/lib/credits";
import { HumanizationFailedError, runHumanization } from "@/lib/humanize-engine";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { ensureCurrentUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_CHARS = 60_000;
const MAX_BODY_BYTES = 100_000;

const bodySchema = z.object({
  text: z
    .string()
    .min(1, "Add some text before humanizing.")
    .max(MAX_TEXT_CHARS, "This text is too long for a single request."),
  tone: z.string().max(64).optional(),
  readability: z.string().max(64).optional(),
  intensity: z.number().int().min(0).max(100).optional(),
  requestId: z.string().min(8).max(128).optional(),
});

function errorResponse(error: string, code: string, status: number, extra?: Record<string, unknown>) {
  const body: ApiErrorResponse & Record<string, unknown> = { error, code, ...extra };
  return NextResponse.json(body, { status });
}

function getHumanizationErrorStatus(error: HumanizationFailedError): number {
  if (error.status) return error.status;

  switch (error.code) {
    case "UNAUTHORIZED":
      return 401;
    case "RATE_LIMITED":
      return 429;
    case "MODEL_NOT_FOUND":
    case "QUALITY_CHECK_FAILED":
      return 502;
    case "INVALID_SERVICE_ACCOUNT":
      return 401;
    case "UNAVAILABLE":
    case "MISSING_VERTEX_CONFIG":
    case "INVALID_VERTEX_ENDPOINT":
      return 503;
    default:
      return 502;
  }
}

export async function POST(req: NextRequest) {
  if (!isClerkEnabled) {
    return errorResponse(
      "Authentication is not configured on this deployment.",
      "AUTH_DISABLED",
      503,
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse("This text is too long for a single request.", "PAYLOAD_TOO_LARGE", 413);
  }

  const user = await ensureCurrentUser();
  if (!user) {
    return errorResponse("Sign in required to humanize text", "UNAUTHORIZED", 401);
  }

  const limit = rateLimit(`humanize:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Too many humanization requests. Please wait a moment and try again.",
        code: "RATE_LIMITED",
        retryAfter: limit.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return errorResponse("Invalid request body.", "INVALID_BODY", 400);
  }

  const { text, tone, readability, intensity } = parsed;

  let check;
  try {
    check = await checkCredits(user.id, text);
  } catch (error) {
    if (error instanceof CreditError) {
      return errorResponse(error.message, error.code, 403);
    }
    throw error;
  }

  if (!check.allowed && check.error) {
    const status = check.error.code === "EMPTY_TEXT" ? 400 : 402;
    return errorResponse(check.error.message, check.error.code, status, {
      wordCount: check.wordCount,
      balance: check.balance,
      maxWordsPerRequest: check.maxWordsPerRequest,
      plan: check.plan,
    });
  }

  const requestId = buildRequestId(
    user.id,
    parsed.requestId ?? crypto.randomUUID(),
  );

  const previous = await prisma.humanization.findUnique({
    where: { requestId },
  });

  if (previous) {
    return NextResponse.json({
      id: previous.id,
      output: previous.outputText,
      wordCount: previous.inputWordCount,
      creditsCharged: 0,
      creditsRemaining: check.balance,
      duplicate: true,
    });
  }

  let output: string;
  try {
    output = await runHumanization({ text, tone, readability, intensity });
  } catch (error) {
    const code =
      error instanceof HumanizationFailedError ? error.code : "HUMANIZATION_FAILED";
    const message =
      error instanceof HumanizationFailedError
        ? error.message
        : "Humanization failed. No credits were charged.";
    const status =
      error instanceof HumanizationFailedError
        ? getHumanizationErrorStatus(error)
        : 502;

    return errorResponse(message, code, status, {
      creditsRefunded: 0,
      creditsRemaining: check.balance,
    });
  }

  try {
    const saved = await saveHumanizationAndCharge({
      userId: user.id,
      requestId,
      wordCount: check.wordCount,
      text,
      output,
      tone: tone ?? null,
      readability: readability ?? null,
      intensity: intensity ?? null,
    });

    return NextResponse.json({
      id: saved.id,
      output: saved.output,
      wordCount: saved.wordCount,
      creditsCharged: saved.charged,
      creditsRemaining: saved.balanceAfter,
      duplicate: saved.duplicate,
    });
  } catch (error) {
    if (error instanceof CreditError) {
      return errorResponse(error.message, error.code, 402, {
        wordCount: check.wordCount,
        balance: check.balance,
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const saved = await prisma.humanization.findUnique({
        where: { requestId },
      });
      if (saved) {
        const account = await prisma.creditBalance.findUnique({
          where: { userId: user.id },
        });
        return NextResponse.json({
          id: saved.id,
          output: saved.outputText,
          wordCount: saved.inputWordCount,
          creditsCharged: 0,
          creditsRemaining: account?.balance ?? check.balance,
          duplicate: true,
        });
      }
    }

    console.error("[humanize] Failed to save result after a successful rewrite");
    return errorResponse(
      "Humanization succeeded but could not be saved. No extra credits were charged. Please try again.",
      "SAVE_FAILED",
      500,
      { creditsRemaining: check.balance },
    );
  }
}
