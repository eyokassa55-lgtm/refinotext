import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { PRODUCTION_APP_URL, isLegacyAppHost } from "@/lib/app-url";
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

function isKnownCrawler(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") ?? "";
  return /Googlebot|Google-InspectionTool|Storebot-Google|AdsBot-Google|Bingbot|bingbot|Slurp|DuckDuckBot|Baiduspider|Yandex(Bot|Images)|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|Pingdom|Lighthouse|Chrome-Lighthouse|GPTBot|ClaudeBot|Bytespider|SemrushBot|AhrefsBot/i.test(
    ua,
  );
}

function withRobotsTag(req: NextRequest, response: NextResponse) {
  if (isIndexableRoute(req)) {
    response.headers.set("X-Robots-Tag", "index, follow");
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
  if (isKnownCrawler(req) && !isProtectedRoute(req)) return false;
  return true;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Polar/Clerk webhooks must never hit Clerk auth or host redirects.
  if (isWebhookRoute(req)) {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  if (isLegacyAppHost(host)) {
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
