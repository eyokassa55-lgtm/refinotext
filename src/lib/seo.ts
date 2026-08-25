import type { Metadata } from "next";

import { getAbsoluteUrl, getAppUrl } from "@/lib/app-url";
import { APP_DESCRIPTION, APP_LOGO_SRC, APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import { FAQ_ITEMS } from "@/lib/landing-data";

export const SEO_TITLE = `${APP_NAME} — AI Writing Humanizer`;

export const PAGE_SEO = {
  home: {
    path: "/",
    title: SEO_TITLE,
    description: APP_DESCRIPTION,
  },
  pricing: {
    path: "/pricing",
    title: "Pricing",
    description:
      "Simple RefinoText plans. Start free with 500 words per month, then upgrade to Basic, Pro, or Ultra for more credits and longer humanizations.",
  },
  contact: {
    path: "/contact",
    title: "Contact Us",
    description: `Contact the RefinoText team at ${SUPPORT_EMAIL} for support, billing questions, or partnership inquiries.`,
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How RefinoText collects, uses, and protects your data when you humanize writing with our AI service.",
  },
  terms: {
    path: "/terms",
    title: "Terms of Service",
    description:
      "The terms that govern your use of RefinoText, including accounts, credits, subscriptions, and acceptable use.",
  },
  acceptableUse: {
    path: "/acceptable-use",
    title: "Acceptable Use Policy",
    description:
      "Rules for using RefinoText, including prohibited content and how we handle abuse of the humanizer.",
  },
} as const;

export function pageMetadata(
  path: string,
  title: string,
  description: string,
  options?: { index?: boolean; absoluteTitle?: boolean },
): Metadata {
  const index = options?.index ?? true;
  const ogTitle = options?.absoluteTitle ? title : `${title} | ${APP_NAME}`;
  const url = getAbsoluteUrl(path);

  return {
    title: options?.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      locale: "en_US",
      title: ogTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  };
}

export function buildHomeJsonLd() {
  const url = getAppUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: APP_NAME,
        url,
        logo: `${url}${APP_LOGO_SRC}`,
        email: SUPPORT_EMAIL,
        description: APP_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: APP_NAME,
        url,
        description: APP_DESCRIPTION,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#app`,
        name: APP_NAME,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Writing",
        operatingSystem: "Web",
        description: APP_DESCRIPTION,
        url,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}/#faq`,
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}
