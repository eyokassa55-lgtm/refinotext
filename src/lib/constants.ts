export const APP_NAME = "RefinoText";
/** One-word brand token people type in Google (not “refino text”). */
export const APP_NAME_SLUG = "refinotext";
export const APP_DOMAIN = "refinotext.com";
export const APP_LOGO_SRC = "/logo.png";
export const APP_DESCRIPTION =
  "RefinoText transforms your drafts into clear, natural, and authentic human writing. Create high-quality, human-sounding content effortlessly while preserving your original meaning.";

export const APP_BRAND_ALIASES = [
  APP_NAME,
  APP_NAME_SLUG,
  APP_DOMAIN,
  "refinotext.com",
  "Refino Text",
  "refino text",
  "RefinoText AI",
  "RefinoText humanizer",
] as const;

export const SUPPORT_EMAIL = "support@refinotext.com";

export const ROUTES = {
  home: "/",
  humanizer: "/#humanizer",
  signUpWelcome: "/?welcome=1",
  pricing: "/pricing",
  faq: "/faq",
  signIn: "/sign-in",
  signUp: "/sign-up",
  dashboard: "/dashboard",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  acceptableUse: "/acceptable-use",
  refunds: "/refunds",
} as const;

/** All public sitemap pages — keep these linked from header/footer. */
export const PUBLIC_PAGES = [
  { label: "Home", href: ROUTES.home },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "FAQ", href: ROUTES.faq },
  { label: "Contact", href: ROUTES.contact },
  { label: "Privacy Policy", href: ROUTES.privacy },
  { label: "Terms of Service", href: ROUTES.terms },
  { label: "Refunds", href: ROUTES.refunds },
  { label: "Responsible Use", href: ROUTES.acceptableUse },
] as const;
