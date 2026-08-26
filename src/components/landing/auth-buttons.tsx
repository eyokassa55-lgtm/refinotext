"use client";

import { Show, UserButton } from "@clerk/nextjs";
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
        <Button href={ROUTES.signIn} variant="ghost" size="sm">
          Log in
        </Button>
        <Button href={ROUTES.signUp} size="sm">
          Start free
        </Button>
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
        <Button href={ROUTES.signIn} variant="ghost" className="w-full">
          Log in
        </Button>
        <Button href={ROUTES.signUp} className="w-full">
          Start free
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
