import type { Metadata } from "next";

import { getAbsoluteUrl, getAppUrl } from "@/lib/app-url";
import { APP_DESCRIPTION, APP_LOGO_SRC, APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import { FAQ_ITEMS } from "@/lib/landing-data";

export const SEO_TITLE = `${APP_NAME}: Free AI Humanizer for Clear, Natural Writing`;

/** Fresh lastmod for sitemap and JSON-LD. Update when public pages change. */
export const SITE_LAST_MODIFIED = new Date("2026-10-11T08:00:00.000Z");

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
    description:
      "RefinoText turns your drafts into clear, natural, and polished writing. Revise AI-assisted text for tone and readability while keeping your meaning.",
  },
  pricing: {
    path: "/pricing",
    title: "Pricing",
    description:
      "Choose your free RefinoText plan. Simple pricing for monthly and annual writing credits.",
  },
  contact: {
    path: "/contact",
    title: "Contact Us",
    description:
      "How can we help? The RefinoText support team is ready to help with your account, billing, or writing questions.",
  },
  faq: {
    path: "/faq",
    title: "FAQ",
    description:
      "What is RefinoText? RefinoText is an AI writing tool that revises drafts into clearer, more natural writing.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How RefinoText collects, uses, and stores account and writing data, and the role of processors including Clerk, Neon, Polar, and AI providers.",
  },
  terms: {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Terms for using RefinoText, including accounts, credits, Polar checkout, automatic renewal, and acceptable use.",
  },
  refunds: {
    path: "/refunds",
    title: "Refunds and Cancellation",
    description:
      "How RefinoText subscriptions renew, how to cancel through Polar, and when refunds may be available.",
  },
  acceptableUse: {
    path: "/acceptable-use",
    title: "Responsible Use",
    description:
      "RefinoText helps you refine and improve how your writing reads. Use it to revise your own drafts.",
  },
  signIn: {
    path: "/sign-in",
    title: "Sign In",
    description: "Welcome back. Secure sign-in to your RefinoText account.",
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
        logo: {
          "@type": "ImageObject",
          url: getAbsoluteUrl(APP_LOGO_SRC),
        },
        email: SUPPORT_EMAIL,
        description: APP_DESCRIPTION,
        contactPoint: {
          "@type": "ContactPoint",
          email: SUPPORT_EMAIL,
          contactType: "customer support",
        },
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
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${url}/#app`,
        name: APP_NAME,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Writing",
        operatingSystem: "Web",
        description: APP_DESCRIPTION,
        url,
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "0",
          highPrice: "39.99",
          priceCurrency: "USD",
          offerCount: "4",
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
    ],
  };
}

export function buildFaqPageJsonLd() {
  const url = getAppUrl();
  const pageUrl = getAbsoluteUrl(PAGE_SEO.faq.path);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: "en-US",
    isPartOf: { "@id": `${url}/#website` },
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildWebPageJsonLd(path: string, title: string, description: string) {
  const url = getAppUrl();
  const pageUrl = getAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": `${url}/#website` },
    dateModified: SITE_LAST_MODIFIED.toISOString(),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: APP_NAME,
          item: url,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: title,
          item: pageUrl,
        },
      ],
    },
  };
}
