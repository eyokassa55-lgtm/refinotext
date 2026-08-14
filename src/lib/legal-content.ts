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

export const LEGAL_PAGES: Record<string, LegalPage> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    lastUpdated: "August 13, 2026",
    intro:
      "RefinoText is committed to protecting your privacy. This policy explains what we collect, how we use it, and the choices you have.",
    sections: [
      {
        title: "1. Introduction",
        content:
          "RefinoText (“we”, “us”, or “our”) operates an AI writing humanizer service. By using RefinoText, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use the service.",
      },
      {
        title: "2. Information We Collect",
        content: "We collect information in the following categories:",
        subsections: [
          {
            title: "Personal Information",
            content: "When you create an account, we may collect:",
            bullets: [
              "Email address",
              "Name (optional)",
              "Password (encrypted)",
              "Payment information (processed by our payment provider)",
            ],
          },
          {
            title: "Usage Information",
            content: "When you use the product, we may collect:",
            bullets: [
              "Text you submit for humanization (processed securely)",
              "Feature usage and settings preferences",
              "Device, browser, and approximate location data",
              "Log data such as IP address and timestamps",
            ],
          },
        ],
      },
      {
        title: "3. How We Use Your Information",
        content: "We use collected information to:",
        bullets: [
          "Provide, maintain, and improve the RefinoText service",
          "Process subscriptions and payments",
          "Send important account and product updates",
          "Detect abuse, fraud, and security issues",
          "Analyze product performance in aggregate form",
        ],
      },
      {
        title: "4. How We Handle Your Text",
        content:
          "Your submitted writing is processed to deliver humanization results. We do not sell your content. Text is not used to train public AI models. Content is retained only as needed to provide the service, history features you enable, or legal compliance.",
      },
      {
        title: "5. Sharing of Information",
        content:
          "We may share limited data with trusted service providers who help us operate the product (for example authentication, hosting, analytics, and payments). These providers may only use data to perform services for us under appropriate agreements. We may also disclose information if required by law.",
      },
      {
        title: "6. Data Security",
        content:
          "We use industry-standard safeguards to protect your account and data, including encryption in transit and access controls. No method of transmission or storage is 100% secure, so we cannot guarantee absolute security.",
      },
      {
        title: "7. Your Rights & Choices",
        content: "Depending on your location, you may have rights to:",
        bullets: [
          "Access the personal data we hold about you",
          "Request correction or deletion of your data",
          "Export your data",
          "Opt out of non-essential communications",
        ],
      },
      {
        title: "8. Contact",
        content:
          `Questions about this Privacy Policy can be sent to ${SUPPORT_EMAIL}. We will respond as promptly as reasonably possible.`,
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    lastUpdated: "August 14, 2026",
    subtitle:
      "Please read these terms carefully before using RefinoText. By using our service, you agree to these terms.",
    intro:
      "These Terms of Service govern your use of RefinoText and provide information about the RefinoText Service. By using our services, you agree to these terms.",
    footerNote:
      "RefinoText is not a tool for academic dishonesty or cheating. We encourage responsible use that enhances your work while respecting academic integrity.",
    footerLinkLabel: "Read more",
    footerLinkHref: "/acceptable-use",
    sections: [
      {
        title: "1. Acceptance of Terms",
        content:
          "By accessing and using RefinoText, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our service.",
      },
      {
        title: "2. Description of Service",
        content:
          "RefinoText provides an AI-powered text humanization service that transforms AI-generated content into natural, human-like writing. Our service includes:",
        bullets: [
          "Text humanization with multiple tone and style presets",
          "AI detection bypass capabilities",
          "Word-based usage limits by plan",
          "API access for Ultra plan subscribers",
          "History tracking and management",
        ],
      },
      {
        title: "3. User Accounts",
        content: "To use certain features of our service, you must register for an account. You are responsible for:",
        bullets: [
          "Maintaining the confidentiality of your account credentials",
          "All activities that occur under your account",
          "Notifying us immediately of any unauthorized use",
          "Ensuring your account information is accurate and up-to-date",
        ],
      },
      {
        title: "4. Acceptable Use",
        content: "You agree not to use RefinoText to:",
        bullets: [
          "Violate any laws or regulations",
          "Infringe on intellectual property rights",
          "Transmit harmful or malicious content",
          "Attempt to gain unauthorized access to our systems",
          "Use the service for any illegal or unethical purposes",
          "Resell or redistribute our service without permission",
        ],
      },
      {
        title: "5. Payment and Subscriptions",
        content: "RefinoText offers both free and paid plans:",
        bullets: [
          "Free Plan: Limited words provided at signup",
          "Paid Plans: Subscription-based with monthly or yearly billing",
          "Usage: Word limits apply per month according to your plan",
          "Refunds: We're confident in the quality of our AI humanizer. If you're not satisfied with the results, please contact our support team within 7 days of purchase, and we'll work with you to find a solution.",
          "Cancellation: You may cancel your subscription at any time",
        ],
      },
      {
        title: "6. Intellectual Property",
        content:
          "The service and its original content, features, and functionality are owned by RefinoText and are protected by international copyright, trademark, and other intellectual property laws. Content you create using our service remains yours, but you grant us a license to process and humanize your text to provide the service.",
      },
      {
        title: "7. API Usage (Ultra Plan)",
        content: "Ultra plan subscribers with API access must:",
        bullets: [
          "Keep API keys confidential and secure",
          "Not exceed rate limits or abuse the API",
          "Not share API keys with unauthorized parties",
          "Monitor API key usage and deactivate if compromised",
        ],
      },
      {
        title: "8. Disclaimer of Warranties",
        content:
          'The service is provided "as is" and "as available" without any warranties of any kind, either express or implied. We do not guarantee that:',
        bullets: [
          "The service will be uninterrupted or error-free",
          "The humanized text will bypass all AI detection systems",
          "The service will meet all your specific requirements",
          "All errors will be corrected",
        ],
      },
      {
        title: "9. Limitation of Liability",
        content:
          "To the maximum extent permitted by law, RefinoText shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
      },
      {
        title: "10. Changes to Terms",
        content:
          "We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the service. Continued use of the service after changes constitutes acceptance of the new terms.",
      },
      {
        title: "11. Termination",
        content:
          "We may terminate or suspend your account and access to the service immediately, without prior notice, for any breach of these Terms of Service.",
      },
      {
        title: "12. Governing Law",
        content:
          "These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.",
      },
      {
        title: "13. Contact Information",
        content:
          "For questions about these Terms of Service, please contact us. We typically respond within 24 hours.",
        email: SUPPORT_EMAIL,
      },
    ],
  },
  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    lastUpdated: "August 13, 2026",
    intro:
      "This Acceptable Use Policy explains what is and is not allowed when using RefinoText. It helps keep the platform safe, fair, and useful for everyone.",
    sections: [
      {
        title: "1. Purpose",
        content:
          "RefinoText is built to help users refine writing with a more natural human tone. This policy sets clear boundaries so the product is not used for harm, abuse, or illegal activity.",
      },
      {
        title: "2. Allowed Uses",
        content: "You may use RefinoText to:",
        bullets: [
          "Rewrite AI drafts into clearer, more natural writing",
          "Edit your own content for readability and style",
          "Support legitimate personal, academic, or professional writing workflows",
          "Test features within your plan limits",
        ],
      },
      {
        title: "3. Prohibited Uses",
        content: "You may not use RefinoText to:",
        bullets: [
          "Create or distribute illegal, harmful, or fraudulent content",
          "Harass, threaten, or exploit others",
          "Violate academic integrity policies or submit work dishonestly where prohibited",
          "Attempt unauthorized access, scraping, or service disruption",
          "Share account credentials or resell access without permission",
          "Bypass usage limits, payment systems, or security controls",
        ],
      },
      {
        title: "4. Content Responsibility",
        content:
          "You are solely responsible for the text you submit and how you use the output. Always review results before publishing, submitting, or sharing them.",
      },
      {
        title: "5. Enforcement",
        content:
          "We may investigate suspected violations and take action, including warnings, feature limits, suspension, or permanent account termination. Serious abuse may be reported to relevant authorities.",
      },
      {
        title: "6. Reporting",
        content:
          `If you believe someone is misusing RefinoText, contact ${SUPPORT_EMAIL} with details so we can review the report.`,
      },
    ],
  },
};

export const CONTACT_FAQS = [
  {
    question: "How quickly do you reply?",
    answer:
      "We aim to respond to most support requests within 1–2 business days. Priority plan customers may receive faster replies.",
  },
  {
    question: "What should I include in my message?",
    answer:
      "Include your account email, a clear description of the issue, and any screenshots or error messages. That helps us solve things faster.",
  },
  {
    question: "Can I request a refund?",
    answer: `Refund eligibility depends on your plan and local consumer laws. Email ${SUPPORT_EMAIL} with your subscription details and our team will review your request.`,
  },
  {
    question: "Where else can I get help?",
    answer: `Check the FAQ on the homepage for common product questions, or email ${SUPPORT_EMAIL} directly for support and billing issues.`,
  },
] as const;
