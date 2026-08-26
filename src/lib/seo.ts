import type { Metadata } from "next";

import { getAbsoluteUrl, getAppUrl } from "@/lib/app-url";
import { APP_DESCRIPTION, APP_LOGO_SRC, APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import { FAQ_ITEMS } from "@/lib/landing-data";

export const SEO_TITLE = `${APP_NAME} — AI Writing Humanizer`;

/** Fresh lastmod for sitemap and JSON-LD. Update when public pages change. */
export const SITE_LAST_MODIFIED = new Date("2026-08-26T14:00:00.000Z");

const indexableRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

const OG_IMAGE = {
  width: 1200,
  height: 630,
} as const;

export const PAGE_SEO = {
  home: {
    path: "/",
    title: SEO_TITLE,
    description: APP_DESCRIPTION,
  },
  pricing: {
    path: "/pricing",
    title: "Pricing — Plans & Credits",
    description:
      "Compare RefinoText plans. Start free with 500 words per month, then upgrade to Basic, Pro, or Ultra for more credits and longer humanizations.",
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
  signIn: {
    path: "/sign-in",
    title: "Sign In",
    description: `Sign in to your ${APP_NAME} account to humanize writing and manage credits.`,
  },
  signUp: {
    path: "/sign-up",
    title: "Sign Up",
    description: `Create a free ${APP_NAME} account to humanize AI-generated text. No credit card required.`,
  },
  dashboard: {
    path: "/dashboard",
    title: "Credits",
    description: `View your ${APP_NAME} credit balance, plan, and recent humanization activity.`,
  },
} as const;

function socialImages(alt: string) {
  return [
    {
      url: getAbsoluteUrl("/opengraph-image"),
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
      alt,
    },
  ];
}

export function pageMetadata(
  path: string,
  title: string,
  description: string,
  options?: { index?: boolean; absoluteTitle?: boolean },
): Metadata {
  const index = options?.index ?? true;
  const ogTitle = options?.absoluteTitle ? title : `${title} | ${APP_NAME}`;
  const url = getAbsoluteUrl(path);
  const images = socialImages(ogTitle);

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
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images,
    },
    robots: index
      ? indexableRobots
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        },
  };
}

export function buildOrganizationAndWebsiteJsonLd() {
  const url = getAppUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: APP_NAME,
        url,
        logo: getAbsoluteUrl(APP_LOGO_SRC),
        email: SUPPORT_EMAIL,
        description: APP_DESCRIPTION,
        foundingDate: "2026",
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: APP_NAME,
        url,
        description: APP_DESCRIPTION,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en-US",
        dateModified: SITE_LAST_MODIFIED.toISOString(),
      },
    ],
  };
}

export function buildHomeJsonLd() {
  const url = getAppUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
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
        dateModified: SITE_LAST_MODIFIED.toISOString(),
      },
      {
        "@type": "WebPage",
        "@id": `${url}/#webpage`,
        url,
        name: SEO_TITLE,
        description: APP_DESCRIPTION,
        inLanguage: "en-US",
        isPartOf: { "@id": `${url}/#website` },
        about: { "@id": `${url}/#app` },
        primaryImageOfPage: getAbsoluteUrl("/opengraph-image"),
        dateModified: SITE_LAST_MODIFIED.toISOString(),
        breadcrumb: { "@id": `${url}/#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: APP_NAME,
            item: url,
          },
        ],
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
