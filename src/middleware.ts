import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { PRODUCTION_APP_URL, isLegacyAppHost } from "@/lib/app-url";
import { clerkPublishableKey, isClerkEnabled } from "@/lib/auth-config";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isWebhookRoute(req)) return;

  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signIn);
    }
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = req.headers.get("host");
  if (isLegacyAppHost(host) && !isWebhookRoute(req)) {
    const destination = new URL(
      `${PRODUCTION_APP_URL}${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    return NextResponse.redirect(destination, 308);
  }

  if (!isClerkEnabled || !clerkPublishableKey.startsWith("pk_")) {
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
