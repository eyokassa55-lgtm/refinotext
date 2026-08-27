import { ROUTES } from "@/lib/constants";

export const NAV_LINKS = [
  { label: "Pricing", href: ROUTES.pricing },
  { label: "FAQ", href: ROUTES.faq },
  { label: "Contact", href: ROUTES.contact },
] as const;

export const HERO_FEATURES = [
  { icon: "shield", label: "Natural-sounding rewrites" },
  { icon: "zap", label: "Fast, meaning-preserving edits" },
] as const;

export const TRUST_MARKERS = [
  "Free plan available",
  "No credit card required",
  "Works instantly",
] as const;

export const FEATURES = [
  {
    title: "Natural sentence rhythm",
    description:
      "Rewrites stiff AI phrasing into clearer cadence with varied sentence length and more natural word choice.",
    icon: "sparkles",
  },
  {
    title: "Multiple tone options",
    description:
      "Choose standard, academic, conversational, or professional tone to match your audience.",
    icon: "palette",
  },
  {
    title: "Fast turnaround",
    description:
      "Paste a draft and get a readable rewrite in seconds — no complex setup required.",
    icon: "zap",
  },
  {
    title: "Keeps your meaning",
    description:
      "Your ideas and intent stay intact while the wording becomes clearer and more natural.",
    icon: "target",
  },
  {
    title: "Built for real writing workflows",
    description:
      "Useful for essays, emails, blog posts, product copy, and other AI-assisted drafts you want to refine.",
    icon: "shield-check",
  },
  {
    title: "Privacy-minded processing",
    description:
      "Your text is processed to generate a rewrite. We do not use your content to train public models.",
    icon: "lock",
  },
] as const;

export const AUDIENCE_USE_CASES = [
  {
    title: "Students and researchers",
    description:
      "Turn stiff AI outlines into clearer drafts you can edit, cite, and finish in your own voice.",
  },
  {
    title: "Creators and marketers",
    description:
      "Refine blog posts, emails, and landing copy so they sound less robotic and more on-brand.",
  },
  {
    title: "Professionals and teams",
    description:
      "Clean up reports, proposals, and documentation without rewriting every sentence from scratch.",
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Paste your AI text",
    description:
      "Drop in content from ChatGPT, Claude, Gemini, or any AI writing tool into the editor.",
  },
  {
    step: "02",
    title: "Choose your tone",
    description:
      "Select the voice and style that fits your audience — academic, casual, or professional.",
  },
  {
    step: "03",
    title: "Humanize instantly",
    description:
      "Our engine rewrites your text with clearer rhythm and more natural wording in seconds.",
  },
  {
    step: "04",
    title: "Copy & publish",
    description:
      "Review the output, copy with one click, and keep editing in your own voice.",
  },
] as const;

export type PricingPlan = {
  name: string;
  description: string;
  badge?: string;
  featured?: boolean;
  isFree?: boolean;
  monthlyProductKey?: string;
  yearlyProductKey?: string;
  monthlyPrice: number;
  yearlyPricePerMonth: number;
  originalMonthlyPrice: number;
  originalYearlyPricePerMonth: number;
  creditsPerMonth: number;
  maxWordsPerRequest: number;
  features: string[];
  cta: string;
  href: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Free",
    description: "Try RefinoText at no cost — perfect for light personal use.",
    isFree: true,
    monthlyPrice: 0,
    yearlyPricePerMonth: 0,
    originalMonthlyPrice: 0,
    originalYearlyPricePerMonth: 0,
    creditsPerMonth: 500,
    maxWordsPerRequest: 500,
    features: [
      "500 credits / mo (500 words)",
      "Up to 500 words per request",
      "Basic Humanization Engine",
      "Standard priority on AI generations",
      "Natural rewrite quality",
      "2 tones (Standard, Academic)",
      "Customer support",
    ],
    cta: "Get started free",
    href: "/sign-up",
  },
  {
    name: "Basic",
    description: "Essential humanizing for students and everyday writing.",
    monthlyPrice: 5.99,
    yearlyPricePerMonth: 2.99,
    originalMonthlyPrice: 5.99,
    originalYearlyPricePerMonth: 5.99,
    monthlyProductKey: "basic_monthly",
    yearlyProductKey: "basic_yearly",
    creditsPerMonth: 8000,
    maxWordsPerRequest: 600,
    features: [
      "8,000 credits / mo (8,000 words)",
      "Up to 600 words per request",
      "1 free rehumanization per task",
      "Basic Humanization Engine",
      "Standard priority on AI generations",
      "Clearer, more natural phrasing",
      "Careful rewriting that keeps meaning",
      "3 tones (Standard, Academic, Professional)",
      "All languages supported",
      "Customer support",
    ],
    cta: "Subscribe",
    href: "/sign-up",
  },
  {
    name: "Pro",
    description: "Advanced rewriting for creators and daily high-volume use.",
    badge: "50% OFF",
    featured: true,
    monthlyPrice: 19.99,
    yearlyPricePerMonth: 9.99,
    originalMonthlyPrice: 19.99,
    originalYearlyPricePerMonth: 19.99,
    monthlyProductKey: "pro_monthly",
    yearlyProductKey: "pro_yearly",
    creditsPerMonth: 40000,
    maxWordsPerRequest: 2000,
    features: [
      "40,000 credits / mo (40,000 words)",
      "Up to 2,000 words per request",
      "2 free rehumanizations per task",
      "Ultra Mode access",
      "Faster processing",
      "Advanced Humanization Engine",
      "High priority on AI generations",
      "Clearer, more natural phrasing",
      "Careful rewriting that keeps meaning",
      "All tonalities available",
      "All languages supported",
      "Priority email support",
    ],
    cta: "Subscribe",
    href: "/sign-up",
  },
  {
    name: "Ultra",
    description: "Maximum power for teams, agencies, and power users.",
    monthlyPrice: 39.99,
    yearlyPricePerMonth: 19.99,
    originalMonthlyPrice: 39.99,
    originalYearlyPricePerMonth: 39.99,
    monthlyProductKey: "ultra_monthly",
    yearlyProductKey: "ultra_yearly",
    creditsPerMonth: 90000,
    maxWordsPerRequest: 3000,
    features: [
      "90,000 credits / mo (90,000 words)",
      "Up to 3,000 words per request",
      "3 free rehumanizations per task",
      "Ultra Mode access",
      "Priority processing",
      "Advanced Humanization Engine",
      "Always first on AI generations",
      "Clearer, more natural phrasing",
      "Careful rewriting that keeps meaning",
      "All tonalities available",
      "All languages supported",
      "API access for integrations",
    ],
    cta: "Subscribe",
    href: "/sign-up",
  },
];

export const CREDIT_TOPUPS = [
  {
    name: "Basic Top-up",
    credits: 8_000,
    price: 5.99,
    maxWordsPerRequest: 600,
    href: "/sign-up",
    productKey: "basic_topup",
    featured: false,
  },
  {
    name: "Pro Top-up",
    credits: 40_000,
    price: 19.99,
    maxWordsPerRequest: 2_000,
    href: "/sign-up",
    productKey: "pro_topup",
    featured: true,
  },
  {
    name: "Ultra Top-up",
    credits: 90_000,
    price: 39.99,
    maxWordsPerRequest: 3_000,
    href: "/sign-up",
    productKey: "ultra_topup",
    featured: false,
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What is RefinoText?",
    answer:
      "RefinoText is an AI writing humanizer that transforms robotic AI-generated text into natural, human-sounding prose while preserving your original meaning.",
  },
  {
    question: "Will my text pass AI detectors?",
    answer:
      "RefinoText rewrites AI drafts so they read more naturally. Detector results vary by tool, settings, and input quality, so we do not promise a specific score or outcome.",
  },
  {
    question: "Which AI tools does RefinoText work with?",
    answer:
      "Any AI-generated text works — paste output from ChatGPT, Claude, Gemini, Jasper, Copy.ai, or any other writing assistant.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The free plan includes 500 words per month with no credit card required. Upgrade anytime for more words and advanced features.",
  },
  {
    question: "How is my data handled?",
    answer:
      "Your text is processed securely and is never stored longer than necessary or used to train AI models. We take privacy seriously.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Absolutely. Cancel from your dashboard at any time. You keep access until the end of your billing period.",
  },
] as const;

export const PREVIEW_WORDS = [
  "focus",
  "clarity",
  "rhythm",
  "authentic",
  "natural",
] as const;

export const PREVIEW_TEXT =
  "The primary objective is to maintain focus while ensuring clarity throughout the document. Effective communication requires authentic voice and natural rhythm that resonates with readers on a human level.";

export const TONE_MODES = [
  { id: "standard", label: "Standard", icon: "brain" },
  { id: "academic", label: "Academic", icon: "graduation" },
  { id: "conversational", label: "Conversational", icon: "coffee" },
  { id: "executive", label: "Executive", icon: "briefcase" },
] as const;

export const DETECTORS = [
  { id: "general", label: "Detector" },
  { id: "gptzero", label: "GPTZero" },
  { id: "turnitin", label: "Turnitin" },
  { id: "originality", label: "Originality" },
] as const;

export const READABILITY_LEVELS = [
  "High School",
  "University / Academic Level",
  "Professional",
  "General Audience",
] as const;

export const INTENSITY_LABELS = [
  { min: 0, max: 33, name: "Light Touch" },
  { min: 34, max: 74, name: "Balanced" },
  { min: 75, max: 100, name: "Strong Rewrite" },
] as const;
