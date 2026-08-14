import { CookieConsent } from "@/components/landing/cookie-consent";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {children}
      <CookieConsent />
    </div>
  );
}
