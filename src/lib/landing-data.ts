import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export const NAV_LINKS = [
  { label: "Pricing", href: ROUTES.pricing },
  { label: "FAQ", href: ROUTES.faq },
  { label: "Contact", href: ROUTES.contact },
] as const;

export const HERO_FEATURES = [
  { icon: "shield", label: "Natural rewriting and clearer tone" },
  { icon: "zap", label: "Keeps your meaning while improving readability" },
] as const;

export const TRUST_MARKERS = [
  "Free plan available",
  "No credit card required to start",
  "Typical short drafts return in seconds",
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
      "Choose Standard, Academic, Conversational, or Executive tone to match your audience.",
    icon: "palette",
  },
  {
    title: "Fast turnaround",
    description:
      "Paste a draft and get a readable rewrite in seconds for typical short texts. Longer drafts can take longer.",
    icon: "zap",
  },
  {
    title: "Keeps your meaning",
    description:
      "Your ideas, facts, and intent stay intact while the wording becomes clearer and easier to read.",
    icon: "target",
  },
  {
    title: "Built for real writing workflows",
    description:
      "Useful for essays, emails, blog posts, product copy, and other AI-assisted drafts you want to revise.",
    icon: "shield-check",
  },
  {
    title: "Privacy-minded processing",
    description:
      "Your text is processed to generate a rewrite. We do not sell your content or use it to train our own public models.",
    icon: "lock",
  },
] as const;

export const AUDIENCE_USE_CASES = [
  {
    title: "Students and researchers",
    description:
      "Turn stiff AI outlines into clearer drafts you can edit, cite, and finish in your own voice. RefinoText is a revision aid, not a way to submit work dishonestly.",
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
    title: "Paste your draft",
    description:
      "Drop in text from ChatGPT, Claude, Gemini, or any other writing assistant, or paste your own draft.",
  },
  {
    step: "02",
    title: "Choose tone and readability",
    description:
      "Select Standard, Academic, Conversational, or Executive tone, then set readability and rewrite strength.",
  },
  {
    step: "03",
    title: "Generate a rewrite",
    description:
      "RefinoText rewrites the text for clarity, tone, and readability while aiming to preserve meaning.",
  },
  {
    step: "04",
    title: "Review and copy",
    description:
      "Read the output, copy it, and keep editing in your own voice before you publish or submit it.",
  },
] as const;

export const TRUST_PANELS = [
  {
    title: "Privacy",
    body: "Text you paste is processed to create a rewrite and stored as needed to provide the service, including credit records. We do not sell your writing. See the Privacy Policy for processors such as Clerk, Neon, Polar, and the AI providers we use.",
    href: ROUTES.privacy,
    linkLabel: "Privacy Policy",
  },
  {
    title: "Billing",
    body: "Paid plans are billed by Polar, the merchant of record and reseller for RefinoText checkout. Subscriptions renew automatically until cancelled. RefinoText does not collect or store your card details.",
    href: ROUTES.refunds,
    linkLabel: "Refunds and cancellation",
  },
  {
    title: "Support",
    body: `Email ${SUPPORT_EMAIL} for product, billing, cancellation, or refund questions. We aim to reply within 1–2 business days.`,
    href: ROUTES.contact,
    linkLabel: "Contact support",
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
  yearlyPrice: number;
  creditsPerMonth: number;
  maxWordsPerRequest: number;
  features: string[];
  cta: string;
  href: string;
};

const SHARED_TONES =
  "Standard, Academic, Conversational, and Executive tones";

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Free",
    description: "Try RefinoText at no cost for light personal use.",
    isFree: true,
    monthlyPrice: 0,
    yearlyPrice: 0,
    creditsPerMonth: 500,
    maxWordsPerRequest: 500,
    features: [
      "500 credits per month (500 words)",
      "Up to 500 words per request",
      SHARED_TONES,
      "Email support",
    ],
    cta: "Get started free",
    href: "/sign-up",
  },
  {
    name: "Basic",
    description: "More credits for students and everyday writing.",
    monthlyPrice: 5.99,
    yearlyPrice: 35.88,
    monthlyProductKey: "basic_monthly",
    yearlyProductKey: "basic_yearly",
    creditsPerMonth: 8000,
    maxWordsPerRequest: 600,
    features: [
      "8,000 credits per month (8,000 words)",
      "Up to 600 words per request",
      SHARED_TONES,
      "Email support",
    ],
    cta: "Continue to Polar checkout",
    href: "/sign-up",
  },
  {
    name: "Pro",
    description: "Higher volume for creators and daily writing.",
    featured: true,
    monthlyPrice: 19.99,
    yearlyPrice: 119,
    monthlyProductKey: "pro_monthly",
    yearlyProductKey: "pro_yearly",
    creditsPerMonth: 40000,
    maxWordsPerRequest: 2000,
    features: [
      "40,000 credits per month (40,000 words)",
      "Up to 2,000 words per request",
      SHARED_TONES,
      "Email support",
    ],
    cta: "Continue to Polar checkout",
    href: "/sign-up",
  },
  {
    name: "Ultra",
    description: "Highest included credits for heavy individual use.",
    monthlyPrice: 39.99,
    yearlyPrice: 239.88,
    monthlyProductKey: "ultra_monthly",
    yearlyProductKey: "ultra_yearly",
    creditsPerMonth: 90000,
    maxWordsPerRequest: 3000,
    features: [
      "90,000 credits per month (90,000 words)",
      "Up to 3,000 words per request",
      SHARED_TONES,
      "Email support",
    ],
    cta: "Continue to Polar checkout",
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
      "RefinoText is an AI-assisted writing and revision tool. It rewrites drafts for clearer language, a more natural tone, and better readability while aiming to preserve your meaning. It is not a detector, a cheating service, or a guarantee that text will receive any particular score from another tool.",
  },
  {
    question: "Who is RefinoText for?",
    answer:
      "RefinoText is for students, creators, and professionals who want to revise AI-assisted or rough drafts. You still review the output and remain responsible for how you use it, including school, workplace, and publisher rules.",
  },
  {
    question: "What does RefinoText do?",
    answer:
      "You paste text, choose tone and readability, and receive a rewritten version. Typical controls are Standard, Academic, Conversational, or Executive tone, a readability level, and rewrite strength. The product does not claim to beat AI detectors or to make writing undetectable.",
  },
  {
    question: "How does it work?",
    answer:
      "Sign in, paste your draft into the editor, choose settings, and run a rewrite. Credits are charged on the words you paste in, at 1 word = 1 credit, not on the length of the output. You can then copy the result and keep editing it yourself.",
  },
  {
    question: "What do users receive?",
    answer:
      "A rewritten draft intended to keep your meaning while improving clarity, tone, and readability. Results vary with the input. You should review the output before publishing or submitting it. RefinoText does not provide certificates, detector reports, or guaranteed acceptance anywhere.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Free plan includes 500 credits per month (500 words) and up to 500 words per request. Creating a Free account does not require a credit card. The Free plan can change in the future; current limits are shown on the pricing page.",
  },
  {
    question: "How does paid billing work?",
    answer:
      "Basic, Pro, and Ultra are subscriptions. Monthly plans are billed every month. Annual plans are billed once per year at the annual price shown on the pricing page. Subscriptions renew automatically at the same interval until you cancel. One-time credit top-ups are charged once and are not subscriptions. Polar is the merchant of record and reseller: Polar processes checkout, invoices, applicable sales tax, and refunds. RefinoText does not collect or store card numbers.",
  },
  {
    question: "How do I cancel, and when do charges stop?",
    answer:
      `Cancel through Polar’s Customer Portal using the link in Polar’s purchase and billing emails, or email ${SUPPORT_EMAIL}. Cancellation stops future renewals. You keep access until the end of the current billing period. Recurring charges continue until you cancel. There is no in-app cancel button in the RefinoText dashboard today.`,
  },
  {
    question: "What is the refund policy?",
    answer:
      `Refunds are handled by Polar as merchant of record. Email ${SUPPORT_EMAIL} with your account email and Polar receipt details. We review requests in good faith. Unused subscription time is not automatically refunded unless required by law or Polar issues a refund. Top-up credits that have already been used are generally not refundable. Full details are on the Refunds and Cancellation page.`,
  },
  {
    question: "How is my text handled?",
    answer:
      "Submitted text is sent to our AI providers to generate the rewrite and is stored as needed to operate the service, such as credit accounting and saved rewrite records. We do not sell your content or use it to train our own public models. Providers have their own terms. See the Privacy Policy.",
  },
  {
    question: "How do I get support?",
    answer:
      `Email ${SUPPORT_EMAIL} or use the Contact page. We aim to reply within 1–2 business days. Include your account email and, for billing issues, your Polar receipt or order details.`,
  },
] as const;

export const TONE_MODES = [
  { id: "standard", label: "Standard", icon: "brain" },
  { id: "academic", label: "Academic", icon: "graduation" },
  { id: "conversational", label: "Conversational", icon: "coffee" },
  { id: "executive", label: "Executive", icon: "briefcase" },
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
