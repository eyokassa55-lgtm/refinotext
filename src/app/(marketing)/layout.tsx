import { CookieConsent } from "@/components/landing/cookie-consent";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationAndWebsiteJsonLd } from "@/lib/seo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <JsonLd data={buildOrganizationAndWebsiteJsonLd()} />
      {children}
      <CookieConsent />
    </div>
  );
}
