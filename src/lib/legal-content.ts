import { SUPPORT_EMAIL } from "@/lib/constants";

export type LegalSection = {
  title: string;
  content: string;
  bullets?: string[];
  email?: string;
  subsections?: Array<{
    title: string;
    content?: string;
    bullets?: string[];
  }>;
};

export type LegalPage = {
  slug: string;
  title: string;
  lastUpdated: string;
  intro: string;
  subtitle?: string;
  footerNote?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
  sections: LegalSection[];
};

const LAST_UPDATED = "August 29, 2026";

export const LEGAL_PAGES: Record<string, LegalPage> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    lastUpdated: LAST_UPDATED,
    intro:
      "This Privacy Policy explains what RefinoText collects, how it is used, and the choices you have. It describes the current product. It is not a promise that we never store text, and it is not a claim that we process card payments ourselves.",
    sections: [
      {
        title: "1. Who we are",
        content:
          "RefinoText (“we”, “us”, or “our”) operates an AI-assisted writing and revision service at https://www.refinotext.com. By using RefinoText, you agree to this policy. If you do not agree, do not use the service.",
      },
      {
        title: "2. Information we collect",
        content: "We collect information in these categories:",
        subsections: [
          {
            title: "Account information",
            content:
              "When you create an account, Clerk (our authentication provider) handles sign-in. We may store an identifier, email address, and name associated with your account so we can provide the service. RefinoText does not store your password.",
          },
          {
            title: "Writing you submit",
            content:
              "When you run a rewrite, we process the text you paste, your selected tone, readability, and rewrite strength, and the generated output. We store rewrite records as needed to operate credits, prevent duplicate charges, and provide the service.",
          },
          {
            title: "Usage and logs",
            content:
              "We may collect feature usage, plan and credit balances, device or browser information, IP address, and timestamps needed to run, secure, and debug the service.",
          },
          {
            title: "Payment information",
            content:
              "Paid checkout is handled by Polar, which acts as merchant of record and reseller. Polar and its payment processors collect payment details. RefinoText does not collect, store, or process card numbers.",
          },
        ],
      },
      {
        title: "3. How we use information",
        content: "We use collected information to:",
        bullets: [
          "Provide rewrites, accounts, credits, and plan limits",
          "Authenticate you and keep the service secure",
          "Record credit usage and prevent abuse",
          "Respond to support and billing requests",
          "Comply with law and Polar’s requirements as merchant of record",
        ],
      },
      {
        title: "4. How we handle your text",
        content:
          "Your submitted writing is processed to generate a rewrite. We do not sell your content. We do not use your content to train our own public AI models. Text is retained as needed to provide the service (including stored rewrite records and credit history) or as required for security, billing disputes, or law. AI providers that generate the rewrite receive the prompt and your text in order to return a result, and they have their own privacy terms.",
      },
      {
        title: "5. Processors and sharing",
        content:
          "We share information with service providers who help us operate RefinoText, only as needed for that purpose. Current processors include:",
        bullets: [
          "Clerk — account authentication",
          "Neon — application database",
          "Vercel — hosting",
          "Google Gemini and, when enabled, Fireworks — generating rewrites",
          "Polar — merchant of record for paid orders, subscriptions, invoices, sales tax, and refunds",
        ],
      },
      {
        title: "6. Cookies",
        content:
          "The RefinoText site uses cookies or similar storage that are needed for the website and signed-in sessions (including Clerk). Polar’s checkout and Customer Portal use Polar’s own cookies on Polar’s domain. We do not currently run a separate advertising or analytics cookie program on refinotext.com.",
      },
      {
        title: "7. Data security",
        content:
          "We use standard safeguards such as encryption in transit and access controls. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
      },
      {
        title: "8. Your rights and choices",
        content:
          `Depending on your location, you may have rights to access, correct, delete, or export personal data we hold, or to object to certain processing. To make a request, email ${SUPPORT_EMAIL}. You can also close your RefinoText account by emailing ${SUPPORT_EMAIL}. Polar holds billing records for paid orders as merchant of record.`,
      },
      {
        title: "9. Children",
        content:
          "RefinoText is not directed to children under 16, and we do not knowingly collect personal information from children under 16.",
      },
      {
        title: "10. Contact",
        content: `Questions about this Privacy Policy can be sent to ${SUPPORT_EMAIL}. We aim to reply within 1–2 business days.`,
        email: SUPPORT_EMAIL,
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    lastUpdated: LAST_UPDATED,
    subtitle:
      "Please read these terms before using RefinoText. By using the service, you agree to them.",
    intro:
      "These Terms of Service govern your use of RefinoText, including the free plan, paid subscriptions, and credit top-ups. They describe the current product and Polar’s role in paid checkout.",
    footerNote:
      "RefinoText is a writing revision tool. Do not use it to cheat, to submit work dishonestly, or to circumvent another service’s rules or detectors. You are responsible for how you use the output.",
    footerLinkLabel: "Read the Acceptable Use Policy",
    footerLinkHref: "/acceptable-use",
    sections: [
      {
        title: "1. Acceptance",
        content:
          "By accessing or using RefinoText, you agree to these Terms, the Privacy Policy, the Acceptable Use Policy, and the Refunds and Cancellation Policy. If you do not agree, do not use the service.",
      },
      {
        title: "2. The service",
        content:
          "RefinoText provides AI-assisted rewriting so drafts can read more clearly and naturally while aiming to preserve meaning. Current features include:",
        bullets: [
          "A web editor for pasting text and receiving a rewrite",
          "Tone options: Standard, Academic, Conversational, and Executive",
          "Readability and rewrite-strength controls",
          "Word-based credits (1 word pasted = 1 credit) and plan request limits",
        ],
      },
      {
        title: "3. What the service is not",
        content:
          "RefinoText does not guarantee AI-detector results, undetectable writing, search rankings, academic grades, or publication. It does not currently offer a public API, a detector, Ultra Mode as a separate product, or a dedicated writing-history browser in the dashboard. Dashboard users can see recent credit activity.",
      },
      {
        title: "4. Accounts",
        content: "Some features require an account. You are responsible for:",
        bullets: [
          "Keeping your sign-in credentials confidential",
          "Activity under your account",
          "Telling us promptly if you suspect unauthorized use",
          "Keeping your email accurate so we and Polar can reach you",
        ],
      },
      {
        title: "5. Acceptable use",
        content:
          "You must follow the Acceptable Use Policy. You agree not to use RefinoText to violate law, infringe others’ rights, cheat, evade another service’s rules, attack our systems, or resell access without permission.",
      },
      {
        title: "6. Credits, plans, and pricing",
        content:
          "The Free plan currently includes 500 credits per month and up to 500 words per request, with no credit card required. Paid plans are:",
        bullets: [
          "Basic: $5.99 billed every month, or $35.88 billed once per year; 8,000 credits per month; up to 600 words per request",
          "Pro: $19.99 billed every month, or $119.00 billed once per year; 40,000 credits per month; up to 2,000 words per request",
          "Ultra: $39.99 billed every month, or $239.88 billed once per year; 90,000 credits per month; up to 3,000 words per request",
          "Optional one-time top-ups: Basic $5.99 (8,000 credits), Pro $19.99 (40,000 credits), Ultra $39.99 (90,000 credits)",
        ],
      },
      {
        title: "7. Polar checkout and automatic renewal",
        content:
          "Polar Software, Inc. (“Polar”) is the merchant of record and reseller for paid RefinoText products. When you buy a subscription or top-up, you purchase from Polar. Polar processes payment, invoices, applicable sales tax, and refunds. RefinoText does not collect or store your card details and does not process card payments.",
        bullets: [
          "Monthly subscriptions renew automatically every month until cancelled",
          "Annual subscriptions renew automatically every year until cancelled",
          "Recurring charges continue until you cancel",
          "Top-ups are one-time charges, not subscriptions",
        ],
      },
      {
        title: "8. Cancellation and refunds",
        content:
          `You may cancel a subscription at any time through Polar’s Customer Portal (linked from Polar’s purchase and billing emails) or by emailing ${SUPPORT_EMAIL}. Cancellation stops future renewals. You keep access until the end of the current billing period. Refund rules are in the Refunds and Cancellation Policy.`,
      },
      {
        title: "9. Intellectual property and output",
        content:
          "RefinoText and its branding, software, and original site content are owned by RefinoText or its licensors. Subject to these terms, you retain rights in text you submit. You grant us a license to process that text so we can provide the rewrite. You are responsible for the output you use.",
      },
      {
        title: "10. Disclaimer of warranties",
        content:
          'The service is provided "as is" and "as available" without warranties of any kind, to the maximum extent permitted by law. We do not warrant that:',
        bullets: [
          "The service will be uninterrupted or error-free",
          "A rewrite will match a particular tone, detector score, grade, or publication standard",
          "The service will meet every requirement you have",
          "Every error will be corrected",
        ],
      },
      {
        title: "11. Limitation of liability",
        content:
          "To the maximum extent permitted by law, RefinoText is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the service.",
      },
      {
        title: "12. Changes",
        content:
          "We may update these terms. Material changes may be announced by email or on the site. Continued use after changes take effect means you accept the updated terms.",
      },
      {
        title: "13. Termination",
        content:
          "We may suspend or terminate access if you breach these terms or the Acceptable Use Policy, or if we must do so for security or legal reasons.",
      },
      {
        title: "14. Contact",
        content: `For questions about these terms, email ${SUPPORT_EMAIL}. We aim to reply within 1–2 business days.`,
        email: SUPPORT_EMAIL,
      },
    ],
  },
  refunds: {
    slug: "refunds",
    title: "Refunds and Cancellation Policy",
    lastUpdated: LAST_UPDATED,
    intro:
      "This policy explains prices, renewal, how to cancel, and when refunds may be available. Polar is the merchant of record for paid RefinoText purchases. Your statutory consumer rights are not affected.",
    footerNote:
      "Paid checkout, invoices, sales tax, and refund payouts are handled by Polar, not by a card form on refinotext.com.",
    footerLinkLabel: "View pricing",
    footerLinkHref: "/pricing",
    sections: [
      {
        title: "1. Prices and billing frequency",
        content: "Current paid products are:",
        bullets: [
          "Basic: $5.99 every month, or $35.88 once per year",
          "Pro: $19.99 every month, or $119.00 once per year",
          "Ultra: $39.99 every month, or $239.88 once per year",
          "One-time top-ups: $5.99 / $19.99 / $39.99 depending on the pack",
        ],
      },
      {
        title: "2. Automatic renewal",
        content:
          "Subscriptions renew automatically at the same price and interval until cancelled. Monthly plans renew every month. Annual plans renew every year. Recurring charges continue until you cancel. Top-ups do not renew.",
      },
      {
        title: "3. How to cancel",
        content:
          `Cancel in Polar’s Customer Portal using the manage-subscription or portal link in Polar’s purchase, receipt, and billing emails. You can also email ${SUPPORT_EMAIL} and ask us to help with cancellation. The RefinoText dashboard does not currently include a cancel button.`,
        bullets: [
          "Cancellation stops future renewals",
          "You keep access until the end of the paid period already billed",
          "Cancel before the renewal date if you do not want the next charge",
        ],
      },
      {
        title: "4. Refund eligibility",
        content:
          `Refunds are issued by Polar as merchant of record. Email ${SUPPORT_EMAIL} with your account email and Polar order or receipt details. We review requests in good faith.`,
        bullets: [
          "Duplicate or clearly erroneous Polar charges: we will help Polar correct them",
          "Subscriptions: unused time is not automatically refunded or prorated unless required by law or Polar issues a refund",
          "Top-ups: unused top-up credits may be reviewed case by case; credits already used on rewrites are generally not refundable",
          "Free plan: no payment, so no payment refund",
        ],
      },
      {
        title: "5. Polar’s role",
        content:
          "Polar resells RefinoText paid products. Polar processes the payment, appears as merchant on the charge where applicable, handles invoices and sales tax, and processes refunds. RefinoText does not process card payments. Polar may also issue a refund in its own discretion under Polar’s policies.",
      },
      {
        title: "6. Contact",
        content: `Billing, cancellation, and refund requests: ${SUPPORT_EMAIL}. We aim to reply within 1–2 business days.`,
        email: SUPPORT_EMAIL,
      },
    ],
  },
  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    lastUpdated: LAST_UPDATED,
    intro:
      "This Acceptable Use Policy explains what is and is not allowed when using RefinoText. It keeps the service aligned with honest writing work and with Polar’s rules for products they resell.",
    sections: [
      {
        title: "1. Purpose",
        content:
          "RefinoText helps people revise writing for clarity, tone, and readability. It is not a tool for cheating, detector evasion, or circumventing another service’s terms.",
      },
      {
        title: "2. Allowed uses",
        content: "You may use RefinoText to:",
        bullets: [
          "Rewrite your own drafts so they read more clearly and naturally",
          "Edit AI-assisted text you are allowed to work with",
          "Support legitimate personal, academic, or professional writing workflows, subject to those institutions’ rules",
          "Test the product within your plan limits",
        ],
      },
      {
        title: "3. Prohibited uses",
        content: "You may not use RefinoText to:",
        bullets: [
          "Cheat, submit work dishonestly, or violate academic, workplace, or publisher integrity rules",
          "Circumvent another service’s rules, paywalls, detectors, or terms of use",
          "Create or distribute illegal, harmful, or fraudulent content",
          "Harass, threaten, or exploit others",
          "Attempt unauthorized access, scraping, or disruption of RefinoText",
          "Share account credentials or resell access without permission",
          "Bypass usage limits, payment, or security controls",
        ],
      },
      {
        title: "4. Content responsibility",
        content:
          "You are responsible for the text you submit and how you use the output. Review results before publishing, submitting, or sharing them. RefinoText does not guarantee detector results or that output will be accepted by any third party.",
      },
      {
        title: "5. Enforcement",
        content:
          "We may investigate suspected violations and may warn, limit, suspend, or terminate accounts. Serious abuse may be reported to Polar or to authorities where required.",
      },
      {
        title: "6. Reporting",
        content: `If you believe someone is misusing RefinoText, contact ${SUPPORT_EMAIL} with details.`,
        email: SUPPORT_EMAIL,
      },
    ],
  },
};

export const CONTACT_FAQS = [
  {
    question: "How quickly do you reply?",
    answer:
      "We aim to respond to most support requests within 1–2 business days.",
  },
  {
    question: "What should I include in my message?",
    answer:
      "Include your account email, a clear description of the issue, and any error text. For billing, cancellation, or refunds, include Polar receipt or order details.",
  },
  {
    question: "How do I cancel or request a refund?",
    answer: `Cancel through Polar’s Customer Portal from Polar’s billing emails, or email ${SUPPORT_EMAIL}. Refund eligibility is described in the Refunds and Cancellation Policy. Polar processes refunds as merchant of record.`,
  },
  {
    question: "Where else can I get help?",
    answer: `The homepage FAQ covers product and billing questions. You can also email ${SUPPORT_EMAIL} directly.`,
  },
] as const;
