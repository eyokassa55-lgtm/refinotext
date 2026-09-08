"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Coins } from "lucide-react";
import Link from "next/link";

import { CreditNavBadge } from "@/components/credits/credit-nav-badge";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const signInClassName =
  "text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm";

const getStartedClassName = cn(
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-bold tracking-tight transition-all duration-200",
  "bg-accent-light text-primary hover:bg-accent hover:text-primary-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
);

export function DesktopAuthButtons() {
  if (!isClerkEnabled) {
    return (
      <>
        <Link href={ROUTES.signIn} className={signInClassName}>
          Sign In
        </Link>
        <Link href={ROUTES.signUp} className={getStartedClassName}>
          Get Started
        </Link>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Link href={ROUTES.signIn} className={signInClassName}>
          Sign In
        </Link>
        <Link href={ROUTES.signUp} className={getStartedClassName}>
          Get Started
        </Link>
      </Show>
      <Show when="signed-in">
        <CreditNavBadge />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9",
            },
          }}
        >
          <UserButton.MenuItems>
            <UserButton.Link
              label="Credits & usage"
              labelIcon={<Coins className="h-4 w-4" aria-hidden />}
              href={ROUTES.dashboard}
            />
          </UserButton.MenuItems>
        </UserButton>
      </Show>
    </>
  );
}

export function MobileAuthButtons() {
  if (!isClerkEnabled) {
    return (
      <>
        <Button href={ROUTES.signIn} variant="ghost" className="w-full">
          Sign In
        </Button>
        <Button href={ROUTES.signUp} className="w-full">
          Get Started
        </Button>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Button href={ROUTES.signIn} variant="ghost" className="w-full">
          Sign In
        </Button>
        <Button href={ROUTES.signUp} className="w-full">
          Get Started
        </Button>
      </Show>
      <Show when="signed-in">
        <div className="flex flex-col items-center gap-3 pt-2">
          <CreditNavBadge />
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link
                label="Credits & usage"
                labelIcon={<Coins className="h-4 w-4" aria-hidden />}
                href={ROUTES.dashboard}
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </Show>
    </>
  );
}
