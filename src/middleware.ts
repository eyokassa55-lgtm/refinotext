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
  "/contact(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/acceptable-use(.*)",
]);
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/contact(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/acceptable-use(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/api/webhooks(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image(.*)",
  "/icon(.*)",
  "/apple-icon(.*)",
  "/favicon.ico",
]);

function isKnownCrawler(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") ?? "";
  return /Googlebot|Google-InspectionTool|Storebot-Google|AdsBot-Google|Bingbot|bingbot|Slurp|DuckDuckBot|Baiduspider|Yandex(Bot|Images)|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|Pingdom|Lighthouse|Chrome-Lighthouse|GPTBot|ClaudeBot|Bytespider|SemrushBot|AhrefsBot/i.test(
    ua,
  );
}

const clerkHandler = clerkMiddleware(
  async (auth, req) => {
    if (isWebhookRoute(req) || isPublicRoute(req)) return;

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

  // Public marketing/SEO pages must render as normal HTML. clerkMiddleware
  // still performs a handshake before the callback, and a Development instance
  // redirects that handshake to *.clerk.accounts.dev?__clerk_hs_reason=dev-browser-missing.
  if (isIndexableRoute(req)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "index, follow");
    return response;
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Never send Googlebot (or other crawlers) through a Clerk handshake.
  if (isKnownCrawler(req) && !isProtectedRoute(req)) {
    return NextResponse.next();
  }

  if (process.env.VERCEL_ENV === "production" && isClerkDevelopmentKey) {
    return NextResponse.next();
  }

  if (!isClerkEnabled || !clerkPublishableKey.startsWith("pk_")) {
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|api/webhooks|sitemap\\.xml|robots\\.txt|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
