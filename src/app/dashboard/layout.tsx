import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { BrandLogo } from "@/components/ui/brand-logo";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

const navLinkClass =
  "text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandLogo href={ROUTES.home} className="-ml-3 sm:-ml-4" />
          <nav className="flex min-w-0 items-center gap-3 sm:gap-5" aria-label="Dashboard">
            <Link href={ROUTES.home} className={navLinkClass}>
              Home
            </Link>
            <Link href={ROUTES.humanizer} className={`${navLinkClass} hidden sm:inline`}>
              Humanize
            </Link>
            <Link href={ROUTES.pricing} className={`${navLinkClass} hidden sm:inline`}>
              Pricing
            </Link>
            {isClerkEnabled ? (
              <UserButton />
            ) : (
              <Link href={ROUTES.home} className={navLinkClass}>
                Back to home
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
