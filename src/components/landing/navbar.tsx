"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  DesktopAuthButtons,
  MobileAuthButtons,
} from "@/components/landing/auth-buttons";
import { Container } from "@/components/ui/container";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { NAV_LINKS } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <Container as="nav" ariaLabel="Main navigation">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-12">
            <Link
              href={ROUTES.home}
              className="text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {APP_NAME}
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-mint-dark hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <MobileAuthButtons />
            </div>
          </div>
        </div>
      </Container>
    </header>
  );
}
