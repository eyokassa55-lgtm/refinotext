"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  DesktopAuthButtons,
  MobileAuthButtons,
} from "@/components/landing/auth-buttons";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Container } from "@/components/ui/container";
import { ROUTES } from "@/lib/constants";
import { NAV_LINKS } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: ROUTES.home, match: (path: string) => path === "/" },
  ...NAV_LINKS.map((link) => ({
    ...link,
    match: (path: string) =>
      link.href.startsWith("/#") ? false : path === link.href,
  })),
] as const;

function navLinkClass(isActive: boolean) {
  return cn(
    "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm",
    isActive
      ? "border-b-2 border-accent pb-0.5 text-foreground"
      : "text-muted hover:text-foreground",
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 overflow-x-clip border-b border-border/50 bg-card">
      <Container as="nav" ariaLabel="Main navigation">
        <div className="flex h-16 min-w-0 items-center justify-between gap-3">
          <BrandLogo priority />

          <div className="hidden min-w-0 items-center gap-7 md:flex lg:gap-8">
            {NAV_ITEMS.map((link) => {
              const isActive = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navLinkClass(isActive)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <DesktopAuthButtons />
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div
          id="mobile-menu"
          className={cn(
            "overflow-hidden transition-all duration-300 md:hidden",
            mobileOpen ? "max-h-96 pb-4" : "max-h-0",
          )}
        >
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            {NAV_ITEMS.map((link) => {
              const isActive = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-mint-dark text-foreground"
                      : "text-muted hover:bg-mint-dark hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <MobileAuthButtons />
            </div>
          </div>
        </div>
      </Container>
    </header>
  );
}
