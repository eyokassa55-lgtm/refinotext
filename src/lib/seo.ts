import type { Metadata } from "next";

import { getAbsoluteUrl, getAppUrl } from "@/lib/app-url";
import {
  APP_BRAND_ALIASES,
  APP_DESCRIPTION,
  APP_DOMAIN,
  APP_LOGO_SRC,
  APP_NAME,
  SUPPORT_EMAIL,
} from "@/lib/constants";
import { FAQ_ITEMS } from "@/lib/landing-data";

export const SEO_TITLE = `${APP_NAME}: Free AI Humanizer for Natural Writing`;

/** Fresh lastmod for sitemap and JSON-LD. Update when public pages change. */
export const SITE_LAST_MODIFIED = new Date("2026-10-31T03:00:00.000Z");

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
    title: "Pricing",
    description:
      "Explore RefinoText pricing plans. Get 300 free words to try, then choose Basic, Pro, or Ultra for higher writing limits.",
  },
  contact: {
    path: "/contact",
    title: "Contact Us",
    description:
      "Get in touch with the RefinoText support team. Reach out for technical support, billing assistance, or writing inquiries.",
  },
  faq: {
    path: "/faq",
    title: "Frequently Asked Questions",
    description:
      "RefinoText is an advanced AI writing humanizer that transforms AI-generated drafts into clear, natural, and authentic human writing.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "RefinoText privacy policy. How we collect, use, and protect your account and text revision data.",
  },
  terms: {
    path: "/terms",
    title: "Terms of Service",
    description:
      "RefinoText provides an AI-powered text humanization and revision service. Terms of use, accounts, and subscription details.",
  },
  refunds: {
    path: "/refunds",
    title: "Refunds and Cancellation Policy",
    description:
      "RefinoText refunds and subscription cancellation policy. How subscriptions renew and how to cancel through Polar.",
  },
  acceptableUse: {
    path: "/acceptable-use",
    title: "Responsible Use Policy",
    description:
      "RefinoText is designed to help users improve the quality, tone, and natural flow of their writing responsibly.",
  },
  signIn: {
    path: "/sign-in",
    title: "Sign In",
    description:
      "Sign in to your RefinoText account to access our AI humanizer and transform drafts into natural writing.",
  },
  signUp: {
    path: "/sign-up",
    title: "Sign Up",
    description:
      "Create a free RefinoText account to humanize AI-generated text into polished, natural-sounding writing.",
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
    keywords: [...APP_BRAND_ALIASES, APP_DOMAIN, "AI humanizer", "AI writing tool"],
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
        legalName: APP_NAME,
        alternateName: [...APP_BRAND_ALIASES],
        url,
        logo: {
          "@type": "ImageObject",
          url: getAbsoluteUrl(APP_LOGO_SRC),
        },
        email: SUPPORT_EMAIL,
        description: APP_DESCRIPTION,
        brand: {
          "@type": "Brand",
          name: APP_NAME,
          alternateName: [...APP_BRAND_ALIASES],
          url,
          slogan: `${APP_NAME} — Free AI Humanizer for Clear, Natural Writing`,
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: SUPPORT_EMAIL,
          contactType: "customer support",
        },
        sameAs: ["https://www.instagram.com/aasifcodes/"],
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: APP_NAME,
        alternateName: [...APP_BRAND_ALIASES],
        url: `${url}/`,
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
        alternateName: [...APP_BRAND_ALIASES],
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
        brand: { "@id": `${url}/#organization` },
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
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: ["#hero-heading"],
        },
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
        "@type": "ItemList",
        "@id": `${url}/#navigation`,
        name: "Site Navigation",
        itemListElement: [
          {
            "@type": "SiteNavigationElement",
            position: 1,
            name: PAGE_SEO.faq.title,
            description: PAGE_SEO.faq.description,
            url: `${url}/faq`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 2,
            name: PAGE_SEO.pricing.title,
            description: PAGE_SEO.pricing.description,
            url: `${url}/pricing`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 3,
            name: PAGE_SEO.signIn.title,
            description: PAGE_SEO.signIn.description,
            url: `${url}/sign-in`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 4,
            name: PAGE_SEO.signUp.title,
            description: PAGE_SEO.signUp.description,
            url: `${url}/sign-up`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 5,
            name: PAGE_SEO.terms.title,
            description: PAGE_SEO.terms.description,
            url: `${url}/terms`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 6,
            name: PAGE_SEO.acceptableUse.title,
            description: PAGE_SEO.acceptableUse.description,
            url: `${url}/acceptable-use`,
          },
          {
            "@type": "SiteNavigationElement",
            position: 7,
            name: PAGE_SEO.contact.title,
            description: PAGE_SEO.contact.description,
            url: `${url}/contact`,
          },
        ],
      },
    ],
  };
}

export function buildFaqPageJsonLd(
  items: readonly { question: string; answer: string }[] = FAQ_ITEMS,
  path: string = PAGE_SEO.faq.path,
) {
  const url = getAppUrl();
  const pageUrl = getAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: "en-US",
    isPartOf: { "@id": `${url}/#website` },
    mainEntity: items.map((item) => ({
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
