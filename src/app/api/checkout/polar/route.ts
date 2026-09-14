import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  getAlternateRefinoOrigin,
  getCheckoutOrigin,
  isRefinoProductionHost,
  polarCheckoutReturnUrl,
  polarCheckoutSuccessUrl,
} from "@/lib/app-url";
import { getBillingProduct } from "@/lib/billing";
import { ROUTES } from "@/lib/constants";
import { describePolarError } from "@/lib/polar-error";
import { createPolarCheckout, getPolarTokenStatus } from "@/lib/polar";
import { rateLimit } from "@/lib/rate-limit";
import { ensureCurrentUser } from "@/lib/users";
import type { ApiErrorResponse } from "@/types";
import type { User } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  productKey: z.string().min(1).max(64),
});

function errorResponse(error: string, code: string, status: number) {
  const body: ApiErrorResponse = { error, code };
  return NextResponse.json(body, { status });
}

function pricingErrorRedirect(origin: string, message: string) {
  const pricing = new URL(ROUTES.pricing, `${origin.replace(/\/$/, "")}/`);
  pricing.searchParams.set("checkout_error", message);
  return NextResponse.redirect(pricing);
}

function signInRedirect(origin: string, productKey: string) {
  const signIn = new URL(ROUTES.signIn, `${origin.replace(/\/$/, "")}/`);
  const next = new URL(ROUTES.pricing, `${origin.replace(/\/$/, "")}/`);
  if (productKey) next.searchParams.set("checkout", productKey);
  signIn.searchParams.set("redirect_url", `${next.pathname}${next.search}`);
  return NextResponse.redirect(signIn);
}

async function createCheckoutUrl(params: {
  user: User;
  productKey: string;
  origin: string;
  productionHost: boolean;
}): Promise<{ url: string } | { error: string; code: string; status: number }> {
  const product = getBillingProduct(params.productKey);
  if (!product) {
    return {
      error: "Unknown Polar product.",
      code: "UNKNOWN_PRODUCT",
      status: 400,
    };
  }

  const token = getPolarTokenStatus();
  const alternateOrigin = getAlternateRefinoOrigin(params.origin);

  console.info("[polar/checkout] request", {
    productKey: product.key,
    productId: product.productId,
    configuredServer: token.server,
    tokenPresent: token.present,
    tokenUsable: token.usable,
    productionHost: params.productionHost,
    clerkUserIdPresent: Boolean(params.user.clerkUserId),
    customerEmailPresent: Boolean(params.user.email),
    appUserIdPresent: Boolean(params.user.id),
    polarCustomerPresent: Boolean(params.user.polarCustomerId),
  });

  if (!token.usable) {
    console.error("[polar/checkout] POLAR_ACCESS_TOKEN is missing or unusable");
    return {
      error: "Payments are not configured on this deployment.",
      code: "POLAR_TOKEN_MISSING",
      status: 500,
    };
  }

  try {
    const { checkout, server } = await createPolarCheckout({
      productId: product.productId,
      productKey: product.key,
      customerId: params.user.polarCustomerId,
      externalCustomerId: params.user.clerkUserId,
      customerEmail: params.user.email,
      customerName: params.user.name ?? undefined,
      successUrl: polarCheckoutSuccessUrl(params.origin),
      returnUrl: polarCheckoutReturnUrl(params.origin),
      alternateSuccessUrl: alternateOrigin
        ? polarCheckoutSuccessUrl(alternateOrigin, false)
        : null,
      alternateReturnUrl: alternateOrigin
        ? polarCheckoutReturnUrl(alternateOrigin)
        : null,
      allowSandbox: !params.productionHost,
      metadata: {
        app: "refinotext",
        productKey: product.key,
        productKind: product.kind,
        plan: product.tier,
        interval: product.interval,
        credits: product.credits,
        userId: params.user.id,
        clerkUserId: params.user.clerkUserId,
      },
      customerMetadata: {
        app: "refinotext",
        userId: params.user.id,
        clerkUserId: params.user.clerkUserId,
      },
    });

    if (!checkout.url) {
      console.error("[polar/checkout] Polar returned a checkout without a URL", {
        checkoutId: checkout.id,
        status: checkout.status,
        server,
      });
      return {
        error: "Checkout could not be started. Please try again.",
        code: "CHECKOUT_MISSING_URL",
        status: 502,
      };
    }

    console.info("[polar/checkout] created", {
      checkoutId: checkout.id,
      server,
      productId: product.productId,
    });

    return { url: checkout.url };
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

    return {
      error: info.publicMessage,
      code: "CHECKOUT_FAILED",
      status:
        info.statusCode && info.statusCode >= 400 && info.statusCode < 500
          ? info.statusCode
          : 502,
    };
  }
}

export async function GET(req: NextRequest) {
  const productKey = (req.nextUrl.searchParams.get("productKey") ?? "").trim();
  const origin = getCheckoutOrigin(req.headers, req.url);
  const productionHost = isRefinoProductionHost(new URL(origin).hostname);

  if (!productKey || !getBillingProduct(productKey)) {
    return pricingErrorRedirect(origin, "Choose a plan to continue checkout.");
  }

  const user = await ensureCurrentUser();
  if (!user) {
    return signInRedirect(origin, productKey);
  }

  const limit = rateLimit(`checkout:${user.id}`, 10, 60_000);
  if (!limit.ok) {
    return pricingErrorRedirect(
      origin,
      "Too many checkout attempts. Please wait a moment and try again.",
    );
  }

  const result = await createCheckoutUrl({
    user,
    productKey,
    origin,
    productionHost,
  });

  if ("url" in result) {
    return NextResponse.redirect(result.url);
  }

  return pricingErrorRedirect(origin, result.error);
}

export async function POST(req: NextRequest) {
  const origin = getCheckoutOrigin(req.headers, req.url);
  const productionHost = isRefinoProductionHost(new URL(origin).hostname);
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

  const result = await createCheckoutUrl({
    user,
    productKey: parsed.productKey,
    origin,
    productionHost,
  });

  if ("url" in result) {
    return NextResponse.json({ url: result.url });
  }

  return errorResponse(result.error, result.code, result.status);
}
