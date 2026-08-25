import type { Metadata } from "next";

import { BrandLogo } from "@/components/ui/brand-logo";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-background/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <BrandLogo href={ROUTES.home} />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
