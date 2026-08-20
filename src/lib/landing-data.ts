export const NAV_LINKS = [
  { label: "Humanizer", href: "/#humanizer" },
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Reviews", href: "/#reviews" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const HERO_FEATURES = [
  { icon: "shield", label: "100% Undetectable" },
  { icon: "zap", label: "High Perplexity & Burstiness" },
] as const;

export const TRUST_MARKERS = [
  "Free plan available",
  "No credit card required",
  "Works instantly",
] as const;

export const FEATURES = [
  {
    title: "Bypass AI Detectors",
    description:
      "Refined output designed to pass Turnitin, GPTZero, Originality.ai, and other leading detection tools.",
    icon: "shield-check",
  },
  {
    title: "Natural Human Cadence",
    description:
      "Inject authentic rhythm, varied sentence length, and organic vocabulary into every rewrite.",
    icon: "sparkles",
  },
  {
    title: "Multiple Tone Options",
    description:
      "Choose academic, casual, professional, or creative tones to match your exact writing style.",
    icon: "palette",
  },
  {
    title: "Lightning Fast",
    description:
      "Get polished, human-sounding text in seconds — no waiting, no complex setup required.",
    icon: "zap",
  },
  {
    title: "Preserves Meaning",
    description:
      "Your core ideas and intent stay intact while the delivery becomes unmistakably human.",
    icon: "target",
  },
  {
    title: "Privacy First",
    description:
      "Your content is processed securely and never used to train models or shared with third parties.",
    icon: "lock",
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
      "Our engine rewrites your text with natural perplexity and burstiness in seconds.",
  },
  {
    step: "04",
    title: "Copy & publish",
    description:
      "Review the output, copy with one click, and publish with confidence.",
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
      "Bypass common AI detectors",
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
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
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
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
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
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
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
      "RefinoText is engineered to increase perplexity and burstiness — key signals AI detectors look for. Results vary by detector and input quality, but our engine targets 99%+ human scores.",
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
  { min: 75, max: 100, name: "Deep Bypass" },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "It was an incredible experience. RefinoText made my ChatGPT drafts sound like I actually wrote them — natural, confident, and completely undetectable.",
    name: "Kerod Kibatu",
    source: "Google Play review",
  },
  {
    quote:
      "I used to spend hours rewriting AI copy. Now I paste, refine, and publish. The cadence is so human that even my editor couldn't tell.",
    name: "Amelia Chen",
    source: "Product Hunt review",
  },
  {
    quote:
      "Turnitin kept flagging my outlines. After RefinoText, every submission came back clean without losing my original argument.",
    name: "Marcus Hale",
    source: "Trustpilot review",
  },
  {
    quote:
      "The intensity slider is the killer feature. Light touch for emails, deep bypass for long-form. Exactly the control I wanted.",
    name: "Sofia Alvarez",
    source: "G2 review",
  },
  {
    quote:
      "We rolled this out across our content team. Output quality jumped overnight — less robotic, more on-brand, zero extra workflow.",
    name: "James Okonkwo",
    source: "Capterra review",
  },
] as const;
