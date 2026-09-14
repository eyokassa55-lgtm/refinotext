import { NextResponse, type NextRequest } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";

import { env } from "@/lib/env";
import {
  PolarWebhookSkipError,
  processPolarWebhookEvent,
} from "@/lib/polar-fulfillment";
import { redactPolarSecrets } from "@/lib/polar-error";
import { prisma } from "@/lib/prisma";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

function logWebhook(
  status: number,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    sanitized[key] =
      typeof value === "string" ? redactPolarSecrets(value) : value;
  }
  console.info("[polar/webhook]", { status, ...sanitized });
}

function webhookHeaders(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function parseRawPolarEvent(body: string): { type: string; data: unknown } | null {
  try {
    const parsed = JSON.parse(body) as { type?: unknown; data?: unknown };
    if (typeof parsed.type === "string" && parsed.type.trim()) {
      return { type: parsed.type.trim(), data: parsed.data };
    }
  } catch {
    return null;
  }
  return null;
}

function eventDataId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const id = (data as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "polar-webhook" });
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  if (!env.polar.webhookSecret) {
    logWebhook(500, { code: "WEBHOOK_SECRET_MISSING" });
    return errorResponse(
      "POLAR_WEBHOOK_SECRET is not configured.",
      "WEBHOOK_SECRET_MISSING",
      500,
    );
  }

  const body = await req.text();
  const headerRecord = webhookHeaders(req.headers);
  const hasSignature = Boolean(headerRecord["webhook-signature"]);

  let eventType: string;
  let eventData: unknown;

  try {
    const event = validateEvent(body, headerRecord, env.polar.webhookSecret);
    eventType = event.type;
    eventData = event.data;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      logWebhook(400, {
        code: "INVALID_SIGNATURE",
        hasSignature,
        errorName: error.name,
      });
      return errorResponse("Invalid webhook signature.", "INVALID_SIGNATURE", 400);
    }

    if (error instanceof SDKValidationError) {
      const raw = parseRawPolarEvent(body);
      if (!raw) {
        logWebhook(200, {
          code: "UNPARSED_EVENT",
          hasSignature,
          errorName: error.name,
          message: error.message.slice(0, 180),
          elapsedMs: Date.now() - started,
        });
        return NextResponse.json({ received: true, ignored: true });
      }
      logWebhook(200, {
        code: "RAW_EVENT_FALLBACK",
        type: raw.type,
        hasSignature,
        errorName: error.name,
        message: error.message.slice(0, 180),
      });
      eventType = raw.type;
      eventData = raw.data;
    } else {
      logWebhook(400, {
        code: "INVALID_WEBHOOK",
        hasSignature,
        errorName: error instanceof Error ? error.name : "Error",
      });
      return errorResponse("Invalid webhook payload.", "INVALID_WEBHOOK", 400);
    }
  }

  const webhookId =
    req.headers.get("webhook-id") ??
    (eventDataId(eventData) ? `polar:${eventType}:${eventDataId(eventData)}` : null);

  if (webhookId) {
    const alreadyProcessed = await prisma.processedWebhook.findUnique({
      where: { id: webhookId },
    });
    if (alreadyProcessed) {
      logWebhook(200, {
        code: "DUPLICATE",
        type: eventType,
        elapsedMs: Date.now() - started,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    await processPolarWebhookEvent(eventType, eventData);

    if (webhookId) {
      await prisma.processedWebhook.createMany({
        data: [
          {
            id: webhookId,
            source: "polar",
            eventType,
          },
        ],
        skipDuplicates: true,
      });
    }
  } catch (error) {
    if (error instanceof PolarWebhookSkipError) {
      logWebhook(200, {
        code: "SKIPPED",
        type: eventType,
        errorName: error.name,
        message: error.message,
        elapsedMs: Date.now() - started,
      });
      return NextResponse.json({ received: true, skipped: true });
    }

    logWebhook(500, {
      code: "WEBHOOK_HANDLER_FAILED",
      type: eventType,
      errorName: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
      elapsedMs: Date.now() - started,
    });
    return errorResponse("Webhook processing failed.", "WEBHOOK_HANDLER_FAILED", 500);
  }

  logWebhook(200, {
    code: "OK",
    type: eventType,
    elapsedMs: Date.now() - started,
  });
  return NextResponse.json({ received: true });
}
