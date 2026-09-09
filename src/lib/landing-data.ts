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
    title: "Same topic, same facts",
    description:
      "Humanize uses the full English Wikipedia for matching topics (about 95% of drafts). Only when nothing related fits does it use the tuned model.",
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

export const FEATURES_HIGHLIGHTS = [
  {
    title: "Natural sentence rhythm",
    description:
      "Rewrites stiff AI phrasing into clearer cadence with varied sentence length and more natural word choice.",
    icon: "sparkles",
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
      "Your text is processed to generate a rewrite. We do not sell your content or use it to train public models.",
    icon: "lock",
    docHref: ROUTES.privacy,
    docLabel: "Privacy",
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
    title: "Click Humanize",
    description:
      "RefinoText looks up your topic on the full English Wikipedia. If no related article fits, it falls back to the tuned rewrite model.",
  },
  {
    step: "03",
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

const SHARED_REWRITE = "Natural rewrite that keeps your meaning";

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
      SHARED_REWRITE,
      "Email support",
    ],
    cta: "Get started free",
    href: "/sign-up",
  },
  {
    name: "Basic",
    description: "Everything you need to humanize confidently.",
    monthlyPrice: 5.99,
    yearlyPrice: 35.88,
    monthlyProductKey: "basic_monthly",
    yearlyProductKey: "basic_yearly",
    creditsPerMonth: 8000,
    maxWordsPerRequest: 600,
    features: [
      "8,000 words / mo",
      "Up to 600 words per request",
      "1 free rehumanization per text",
      "Basic Humanization Engine",
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
      "Default humanization preset",
      "All languages supported",
      "Customer support",
    ],
    cta: "Get Started",
    href: "/sign-up",
  },
  {
    name: "Pro",
    description: "Everything you need to humanize confidently.",
    featured: true,
    monthlyPrice: 19.99,
    yearlyPrice: 119,
    monthlyProductKey: "pro_monthly",
    yearlyProductKey: "pro_yearly",
    creditsPerMonth: 40000,
    maxWordsPerRequest: 2000,
    features: [
      "40,000 words / mo",
      "Up to 2,000 words per request",
      "2 free rehumanizations per text",
      "Faster processing",
      "Advanced Humanization Engine",
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
      "All core humanization presets",
      "All languages supported",
      "Priority email support",
      "New features added for free",
    ],
    cta: "Go Pro",
    href: "/sign-up",
  },
  {
    name: "Ultra",
    description: "Everything you need to humanize confidently.",
    monthlyPrice: 39.99,
    yearlyPrice: 239.88,
    monthlyProductKey: "ultra_monthly",
    yearlyProductKey: "ultra_yearly",
    creditsPerMonth: 90000,
    maxWordsPerRequest: 3000,
    features: [
      "90,000 words / mo",
      "Up to 3,000 words per request",
      "3 free rehumanizations per text",
      "Priority processing",
      "Advanced Humanization Engine",
      "Bypass all AI detectors (incl. Turnitin & GPTZero)",
      "Error free rewriting",
      "All core humanization presets",
      "All languages supported",
      "API access for integrations",
      "Team support",
      "Dedicated support & onboarding",
    ],
    cta: "Go Ultra",
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

export const FAQ_LANDING_ITEMS = [
  {
    question: "Why is RefinoText different from other writing tools?",
    answer:
      "RefinoText focuses on revising drafts for clearer, more natural language while aiming to preserve your meaning. You paste text, run Humanize, review the result, and keep editing in your own voice. It is a revision aid—not a detector bypass or cheating service.",
  },
  {
    question: "Is my content secure?",
    answer:
      "Submitted text is processed to generate your rewrite and stored only as needed to run the service, such as credit accounting. We do not sell your content or use it to train our own public models. See the Privacy Policy for full details.",
  },
  {
    question: "How do credits work?",
    answer:
      "Credits are charged on the words you paste in—1 word equals 1 credit. The Free plan includes 500 credits per month with no credit card required. Paid plans and top-ups add more credits; billing is handled by Polar.",
  },
] as const;

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqSection = {
  title: string;
  items: readonly FaqItem[];
};

export const FAQ_PAGE_SECTIONS: readonly FaqSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is RefinoText?",
        answer:
          "RefinoText is an AI-powered text humanizer that rewrites drafts into clearer, more natural writing. Our humanizer helps you polish AI-assisted content while preserving the original meaning and intent—you review every result before you publish or submit.",
      },
      {
        question: "How does the humanizer work?",
        answer:
          "Paste your draft into the editor and run Humanize. RefinoText analyzes sentence structure, word choice, and flow, then rewrites the text for a more natural voice. You can adjust tone and readability presets—such as Standard, Academic, or Conversational—to match how you actually write.",
      },
      {
        question: "Is RefinoText free to use?",
        answer:
          "Yes. RefinoText offers a free plan with 500 credits per month (500 words) and no credit card required. When you need more capacity, you can upgrade to Basic, Pro, or Ultra—or purchase a one-time credit top-up.",
      },
    ],
  },
  {
    title: "Credits & Pricing",
    items: [
      {
        question: "What are credits and how do they work?",
        answer:
          "Credits are used when you humanize text. One credit equals one word you paste in—the output length does not change the charge. Your remaining balance appears in the dashboard. Paid plans renew monthly or annually; top-ups add credits once without a subscription.",
      },
      {
        question: "How does paid billing work?",
        answer:
          "Basic, Pro, and Ultra are subscriptions billed monthly or annually through Polar, our merchant of record. Annual plans are charged once per year at the price shown on the pricing page. Subscriptions renew automatically until you cancel. One-time top-ups are a single charge and are not subscriptions.",
      },
      {
        question: "Can I get a refund if I'm not satisfied?",
        answer:
          `Refunds are handled by Polar as merchant of record. Email ${SUPPORT_EMAIL} within 7 days of purchase with your account email and receipt details. We review requests in good faith. Unused subscription time is not automatically refunded unless required by law. See the Refunds and Cancellation page for full details.`,
      },
    ],
  },
  {
    title: "Quality & Results",
    items: [
      {
        question: "Will the humanized text maintain the original meaning?",
        answer:
          "Yes. RefinoText is designed to preserve your core message, facts, and intent while improving clarity and natural flow. You should always review the output—especially for citations, names, and numbers—before publishing or submitting.",
      },
      {
        question: "What if I'm not happy with the humanized result?",
        answer:
          "Try humanizing again with a different tone or readability setting. Each preset produces a distinct style. You can also edit the result directly in the editor. If you still need help getting the right voice, contact our support team.",
      },
      {
        question: "What do users receive?",
        answer:
          "A rewritten draft aimed at clearer, more natural language while keeping your meaning. Results vary with the input length and style. RefinoText does not provide detector certificates, guaranteed scores from third-party tools, or promises about how other services will classify your text.",
      },
    ],
  },
  {
    title: "Technical & Support",
    items: [
      {
        question: "Is my content secure?",
        answer:
          "Submitted text is processed to generate your rewrite and stored only as needed to operate the service, such as credit accounting. We do not sell your content or use it to train our own public models. See the Privacy Policy for full details.",
      },
      {
        question: "Is there a word limit for humanization?",
        answer:
          "Each request is limited by your plan—for example, 500 words per request on the Free plan. Larger drafts require more credits based on the words you paste in. Check the pricing page for plan limits and your dashboard for your current balance.",
      },
      {
        question: "How do I contact support?",
        answer:
          `Reach us through the Contact page or email ${SUPPORT_EMAIL}. We typically respond within 1–2 business days. Include your account email and, for billing issues, your Polar receipt or order details.`,
      },
    ],
  },
] as const;

export const FAQ_ITEMS = FAQ_PAGE_SECTIONS.flatMap((section) => section.items);

export type FieldNotesTestimonial = {
  quoteBefore: string;
  quoteHighlight: string;
  quoteAfter: string;
  name: string;
  role: string;
  avatarSrc: string;
};

export const FIELD_NOTES_TESTIMONIALS: FieldNotesTestimonial[] = [
  {
    quoteBefore:
      "I paste ChatGPT first drafts into RefinoText before client review. Saves me an hour of ",
    quoteHighlight: "line-by-line cleanup",
    quoteAfter: " every week.",
    name: "Maya Chen",
    role: "Freelance copywriter, Austin",
    avatarSrc: "/testimonials/maya-chen.jpg",
  },
  {
    quoteBefore:
      "Our newsletter team runs every AI-assisted paragraph through RefinoText. Readers stopped asking if a bot wrote it—",
    quoteHighlight: "that's the win",
    quoteAfter: ".",
    name: "James Okonkwo",
    role: "Content lead, remote SaaS startup",
    avatarSrc: "/testimonials/james-okonkwo.jpg",
  },
  {
    quoteBefore:
      "I don't ban AI in my comp class. I require a RefinoText pass and a reflection note. Students learn ",
    quoteHighlight: "when the prose still sounds off",
    quoteAfter: ".",
    name: "Dr. Elena Ruiz",
    role: "Adjunct English, community college (Portland)",
    avatarSrc: "/testimonials/elena-ruiz.jpg",
  },
  {
    quoteBefore:
      "Legal memos need to sound like us, not a template. RefinoText keeps the citations intact and ",
    quoteHighlight: "pulls out the robot phrasing",
    quoteAfter: ".",
    name: "Priya Nair",
    role: "Paralegal, midsize firm (Chicago)",
    avatarSrc: "/testimonials/priya-nair.jpg",
  },
  {
    quoteBefore:
      "Product descriptions from our catalog AI were fine structurally, dead on the page. RefinoText gives them ",
    quoteHighlight: "actual shelf voice",
    quoteAfter: " without rewriting from scratch.",
    name: "Tomás Reyes",
    role: "E-commerce ops, DTC skincare brand",
    avatarSrc: "/testimonials/tomas-reyes.jpg",
  },
  {
    quoteBefore:
      "Conference abstracts have tight word limits. RefinoText tightens AI bloat and ",
    quoteHighlight: "reads like I wrote it at midnight",
    quoteAfter: "—which I did, with help.",
    name: "Dr. Amira Hassan",
    role: "Postdoc, computational biology",
    avatarSrc: "/testimonials/amira-hassan.jpg",
  },
  {
    quoteBefore:
      "High-school debate club kids use AI outlines—fair enough. I show them RefinoText as a rewrite step so arguments stay theirs but ",
    quoteHighlight: "language isn't wooden",
    quoteAfter: " on the flow sheet.",
    name: "Rob Vukovich",
    role: "History teacher, South Bend charter school",
    avatarSrc: "/testimonials/rob-vukovich.jpg",
  },
];

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
