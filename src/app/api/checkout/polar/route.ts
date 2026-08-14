import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getBillingProduct } from "@/lib/billing";
import { env } from "@/lib/env";
import { describePolarError } from "@/lib/polar-error";
import { createPolarCheckout, getPolarTokenStatus } from "@/lib/polar";
import { rateLimit } from "@/lib/rate-limit";
import { ensureCurrentUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  productKey: z.string().min(1).max(64),
});

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const user = await ensureCurrentUser();
  if (!user) {
    return errorResponse("Sign in required to checkout", "UNAUTHORIZED", 401);
  }

  const limit = rateLimit(`checkout:${user.id}`, 10, 60_000);
  if (!limit.ok) {
    return errorResponse(
      "Too many checkout attempts. Please wait a moment and try again.",
      "RATE_LIMITED",
      429,
    );
  }

  let parsed: z.infer<typeof checkoutSchema>;
  try {
    parsed = checkoutSchema.parse(await req.json());
  } catch {
    return errorResponse("Invalid checkout request.", "INVALID_BODY", 400);
  }

  const product = getBillingProduct(parsed.productKey);
  if (!product) {
    return errorResponse("Unknown Polar product.", "UNKNOWN_PRODUCT", 400);
  }

  const token = getPolarTokenStatus();
  console.info("[polar/checkout] request", {
    productKey: product.key,
    productId: product.productId,
    configuredServer: token.server,
    tokenPresent: token.present,
    tokenUsable: token.usable,
    clerkUserIdPresent: Boolean(user.clerkUserId),
    customerEmailPresent: Boolean(user.email),
    appUserIdPresent: Boolean(user.id),
  });

  if (!token.usable) {
    console.error("[polar/checkout] POLAR_ACCESS_TOKEN is missing or unusable");
    return errorResponse(
      "Payments are not configured on this deployment.",
      "POLAR_TOKEN_MISSING",
      500,
    );
  }

  try {
    const appUrl = env.appUrl.replace(/\/$/, "");
    const { checkout, server } = await createPolarCheckout({
      productId: product.productId,
      productKey: product.key,
      externalCustomerId: user.clerkUserId,
      customerEmail: user.email,
      customerName: user.name ?? undefined,
      successUrl: `${appUrl}/dashboard?checkout=success`,
      returnUrl: `${appUrl}/pricing`,
      metadata: {
        app: "refinotext",
        productKey: product.key,
        productKind: product.kind,
        plan: product.tier,
        interval: product.interval,
        credits: product.credits,
        userId: user.id,
        clerkUserId: user.clerkUserId,
      },
      customerMetadata: {
        app: "refinotext",
        userId: user.id,
        clerkUserId: user.clerkUserId,
      },
    });

    if (!checkout.url) {
      console.error("[polar/checkout] Polar returned a checkout without a URL", {
        checkoutId: checkout.id,
        status: checkout.status,
        server,
      });
      return errorResponse(
        "Checkout could not be started. Please try again.",
        "CHECKOUT_MISSING_URL",
        502,
      );
    }

    console.info("[polar/checkout] created", {
      checkoutId: checkout.id,
      server,
      productId: product.productId,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const info = describePolarError(error);
    console.error("[polar/checkout] Polar API error", {
      productKey: product.key,
      productId: product.productId,
      configuredServer: token.server,
      errorName: info.name,
      httpStatus: info.statusCode,
      message: info.message,
      body: info.body,
    });

    return errorResponse(
      info.publicMessage,
      "CHECKOUT_FAILED",
      info.statusCode && info.statusCode >= 400 && info.statusCode < 500
        ? info.statusCode
        : 502,
    );
  }
}
