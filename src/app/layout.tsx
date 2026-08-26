import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";

import { getAbsoluteUrl, getAppUrl } from "@/lib/app-url";
import {
  clerkAfterSignInUrl,
  clerkAfterSignUpUrl,
  clerkAllowedRedirectOrigins,
  clerkPublishableKey,
  clerkSignInUrl,
  clerkSignUpUrl,
  isClerkEnabled,
} from "@/lib/auth-config";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { SEO_TITLE } from "@/lib/seo";

import "./globals.css";

const caveat = localFont({
  src: [
    {
      path: "../fonts/caveat-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/caveat-latin-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-caveat",
  display: "swap",
});

const appUrl = getAppUrl();
const ogImage = {
  url: getAbsoluteUrl("/opengraph-image"),
  width: 1200,
  height: 630,
  alt: SEO_TITLE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e8f5ef",
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: SEO_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME, url: appUrl }],
  creator: APP_NAME,
  publisher: APP_NAME,
  category: "writing",
  keywords: [
    "AI humanizer",
    "AI writing humanizer",
    "humanize AI text",
    "undetectable AI writing",
    "ChatGPT humanizer",
  ],
  openGraph: {
    type: "website",
    url: appUrl,
    locale: "en_US",
    siteName: APP_NAME,
    title: SEO_TITLE,
    description: APP_DESCRIPTION,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: APP_DESCRIPTION,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "OvHJiJbbwkKkdGkA2DPwjigq7tMfvKsiiMNGFfuiUnQ",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-clip">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${caveat.variable} antialiased min-h-screen`}
      >
        {isClerkEnabled ? (
          <ClerkProvider
            appearance={clerkAppearance}
            publishableKey={clerkPublishableKey}
            signInUrl={clerkSignInUrl}
            signUpUrl={clerkSignUpUrl}
            signInFallbackRedirectUrl={clerkAfterSignInUrl}
            signUpFallbackRedirectUrl={clerkAfterSignUpUrl}
            allowedRedirectOrigins={clerkAllowedRedirectOrigins}
            isSatellite={false}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
