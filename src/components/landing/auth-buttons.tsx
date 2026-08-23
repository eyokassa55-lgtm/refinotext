"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Coins } from "lucide-react";

import { CreditNavBadge } from "@/components/credits/credit-nav-badge";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";

export function DesktopAuthButtons() {
  if (!isClerkEnabled) {
    return (
      <>
        <Button href={ROUTES.signIn} variant="ghost" size="sm">
          Log in
        </Button>
        <Button href={ROUTES.signUp} size="sm">
          Start free
        </Button>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="redirect" forceRedirectUrl={ROUTES.home}>
          <button className="text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-2 py-1">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="redirect" forceRedirectUrl={ROUTES.home}>
          <Button size="sm">Start free</Button>
        </SignUpButton>
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
          Log in
        </Button>
        <Button href={ROUTES.signUp} className="w-full">
          Start free
        </Button>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="redirect" forceRedirectUrl={ROUTES.home}>
            <button className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted hover:bg-mint-dark">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="redirect" forceRedirectUrl={ROUTES.home}>
          <Button className="w-full">Start free</Button>
        </SignUpButton>
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
