export const clerkAppearance = {
  variables: {
    colorPrimary: "#0d5c45",
    colorPrimaryForeground: "#ffffff",
    colorText: "#111111",
    colorTextSecondary: "#4a5c55",
    colorBackground: "#ffffff",
    colorInputBackground: "#f8f9fa",
    colorInputText: "#111111",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full",
    card: "rounded-2xl border border-border shadow-sm",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton:
      "border border-border bg-card text-foreground hover:bg-mint-dark/40",
    formButtonPrimary:
      "rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
    formFieldInput:
      "rounded-xl border-border bg-[#f8f9fa] focus:ring-primary",
    footerActionLink: "text-primary hover:text-primary-hover",
    identityPreviewEditButton: "text-primary",
    formFieldLabel: "text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted",
  },
};
