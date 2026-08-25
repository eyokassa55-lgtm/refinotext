import Link from "next/link";

import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { APP_NAME, PUBLIC_PAGES, ROUTES, SUPPORT_EMAIL } from "@/lib/constants";
import { NAV_LINKS } from "@/lib/landing-data";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/80">
      <Container as="footer" className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandLogo href={ROUTES.home} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Transform AI-generated text into authentic human writing. Built for
              students, creators, and professionals.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {SUPPORT_EMAIL}
            </a>
            <Button href={ROUTES.signUp} size="sm" className="mt-6">
              Get started free
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Explore
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href={ROUTES.home}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.humanizer}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Open editor
                </Link>
              </li>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Account
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href={ROUTES.signIn}
                  className="text-sm text-muted transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.signUp}
                  className="text-sm text-muted transition-colors hover:text-foreground"
                >
                  Sign up
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.pricing}
                  className="text-sm text-muted transition-colors hover:text-foreground"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href={ROUTES.contact}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.privacy}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.terms}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.acceptableUse}
                  className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Acceptable Use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted">
            &copy; {currentYear} {APP_NAME}. All rights reserved.
          </p>
          <nav aria-label="Sitemap" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {PUBLIC_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
