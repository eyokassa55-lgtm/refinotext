export const APP_NAME = "RefinoText";
export const APP_LOGO_SRC = "/logo-mark.png";
export const APP_DESCRIPTION =
  "Humanize AI-generated text into natural, human-sounding writing. RefinoText rewrites ChatGPT and other AI drafts while keeping your meaning. Start free.";

export const SUPPORT_EMAIL = "supportrefino@gmail.com";

export const ROUTES = {
  home: "/",
  humanizer: "/#humanizer",
  pricing: "/pricing",
  faq: "/#faq",
  signIn: "/sign-in",
  signUp: "/sign-up",
  dashboard: "/dashboard",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  acceptableUse: "/acceptable-use",
} as const;

/** All public sitemap pages — keep these linked from header/footer. */
export const PUBLIC_PAGES = [
  { label: "Home", href: ROUTES.home },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "Contact", href: ROUTES.contact },
  { label: "Privacy Policy", href: ROUTES.privacy },
  { label: "Terms of Service", href: ROUTES.terms },
  { label: "Acceptable Use", href: ROUTES.acceptableUse },
] as const;
