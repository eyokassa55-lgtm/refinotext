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
    fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full",
    card: "rounded-2xl border border-border/70 shadow-[0_1px_2px_rgba(15,23,20,0.04),0_16px_40px_rgba(13,92,69,0.10)]",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton:
      "border border-border bg-card text-foreground hover:bg-mint-dark/40",
    formButtonPrimary:
      "rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_1px_2px_rgba(13,92,69,0.18),0_8px_20px_rgba(13,92,69,0.16)]",
    formFieldInput:
      "rounded-xl border-border bg-[#f8f9fa] focus:ring-primary",
    footerActionLink: "text-primary hover:text-primary-hover",
    identityPreviewEditButton: "text-primary",
    formFieldLabel: "text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted",
  },
};

export const authPanelAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full gap-4 border-0 bg-transparent p-0 shadow-none",
    header: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    socialButtonsBlockButton:
      "h-11 rounded-full border-0 bg-primary text-sm font-semibold text-white shadow-none hover:bg-primary-hover",
    socialButtonsBlockButtonText: "font-semibold text-white",
    socialButtonsProviderIcon: "brightness-0 invert",
    formButtonPrimary:
      "h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary-hover",
    formFieldInput:
      "h-11 rounded-full border-border bg-white px-4 focus:ring-primary",
    dividerRow: "my-1",
  },
};
