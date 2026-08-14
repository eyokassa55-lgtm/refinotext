import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { isClerkEnabled } from "@/lib/auth-config";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  if (!isClerkEnabled) {
    return (
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Sign in unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Authentication is not configured yet. Add your Clerk keys to{" "}
          <code className="rounded bg-mint-dark px-1.5 py-0.5 text-xs">
            .env.local
          </code>{" "}
          to enable sign in.
        </p>
        <Link
          href={ROUTES.home}
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <SignIn
      appearance={clerkAppearance}
      routing="path"
      path="/sign-in"
      signUpUrl={ROUTES.signUp}
      forceRedirectUrl={ROUTES.home}
    />
  );
}
