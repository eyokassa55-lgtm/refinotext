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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo href={ROUTES.dashboard} />
          {isClerkEnabled ? (
            <UserButton />
          ) : (
            <Link
              href={ROUTES.home}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Back to home
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
