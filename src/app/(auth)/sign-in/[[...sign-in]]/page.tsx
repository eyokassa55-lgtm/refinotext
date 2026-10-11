import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { AuthSplitPanel } from "@/components/auth/auth-split-panel";
import { isClerkEnabled } from "@/lib/auth-config";
import { authPanelAppearance } from "@/lib/clerk-appearance";
import { ROUTES } from "@/lib/constants";
import { PAGE_SEO, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  PAGE_SEO.signIn.path,
  PAGE_SEO.signIn.title,
  PAGE_SEO.signIn.description,
  { absoluteTitle: true },
);

export default function SignInPage() {
  if (!isClerkEnabled) {
    return (
      <div className="max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-[0_1px_2px_rgba(15,23,20,0.04),0_16px_40px_rgba(13,92,69,0.10)]">
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
    <AuthSplitPanel
      title="Welcome back"
      subtitle="Sign in to your account to continue"
      alternatePrompt="New to RefinoText?"
      alternateLabel="Create an account"
      alternateHref={ROUTES.signUp}
    >
      <SignIn
        appearance={authPanelAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl={ROUTES.signUp}
        fallbackRedirectUrl={ROUTES.home}
      />
    </AuthSplitPanel>
  );
}
