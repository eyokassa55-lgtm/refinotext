import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { PRODUCTION_APP_URL, isLegacyAppHost } from "@/lib/app-url";
import { isKnownCrawler } from "@/lib/crawlers";
import {
  clerkAllowedRedirectOrigins,
  clerkPublishableKey,
  clerkSignInUrl,
  clerkSignUpUrl,
  isClerkDevelopmentKey,
  isClerkEnabled,
} from "@/lib/auth-config";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);
const isIndexableRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/faq(.*)",
  "/contact(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/acceptable-use(.*)",
  "/refunds(.*)",
]);

function isPrivateRoute(req: NextRequest) {
  return /^\/(dashboard|sign-in|sign-up|api)(\/|$)/.test(req.nextUrl.pathname);
}

function withRobotsTag(req: NextRequest, response: NextResponse) {
  if (isIndexableRoute(req)) {
    response.headers.set("X-Robots-Tag", "index, follow");
  } else if (isPrivateRoute(req)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

const clerkHandler = clerkMiddleware(
  async (auth, req) => {
    if (isWebhookRoute(req)) return;

    if (isProtectedRoute(req)) {
      const { userId } = await auth();
      if (!userId) {
        const signIn = new URL(clerkSignInUrl, req.url);
        signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
        return NextResponse.redirect(signIn);
      }
    }
  },
  {
    signInUrl: clerkSignInUrl,
    signUpUrl: clerkSignUpUrl,
    authorizedParties: clerkAllowedRedirectOrigins,
  },
);

function shouldRunClerk(req: NextRequest): boolean {
  if (!isClerkEnabled || !clerkPublishableKey.startsWith("pk_")) return false;
  if (process.env.VERCEL_ENV === "production" && isClerkDevelopmentKey) return false;
  if (isKnownCrawler(req.headers.get("user-agent"))) return false;
  return true;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Polar/Clerk webhooks must never hit Clerk auth or host redirects.
  if (isWebhookRoute(req)) {
    return NextResponse.next();
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const hostname = host?.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  if (hostname === "refinotext.com" || isLegacyAppHost(hostname ?? null)) {
    const destination = new URL(
      `${PRODUCTION_APP_URL}${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    return NextResponse.redirect(destination, 308);
  }

  if (!shouldRunClerk(req)) {
    return withRobotsTag(req, NextResponse.next());
  }

  // Browsers need clerkMiddleware on /, /sign-up, and /sign-in so the session
  // cookie is written and Neon can store the Clerk user after signup.
  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|api/webhooks|sitemap\\.xml|robots\\.txt|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
