import { Shield, Sparkles, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { APP_LOGO_SRC, APP_NAME, ROUTES } from "@/lib/constants";
import { DETECTOR_MARKS_ROW_ONE } from "@/lib/detector-marks";

const TRUST_MARKS = DETECTOR_MARKS_ROW_ONE.slice(0, 6);

const PERKS = [
  {
    icon: Shield,
    title: "Secure authentication",
    body: "Your account stays protected while you sign in.",
  },
  {
    icon: Sparkles,
    title: "Quick access",
    body: "Sign in with one click. No extra password step.",
  },
  {
    icon: Users,
    title: "Trusted by writers",
    body: "Writers use RefinoText to revise drafts every day.",
  },
] as const;

type AuthSplitPanelProps = {
  title: string;
  subtitle: string;
  alternatePrompt: string;
  alternateLabel: string;
  alternateHref: string;
  children: React.ReactNode;
};

export function AuthSplitPanel({
  title,
  subtitle,
  alternatePrompt,
  alternateLabel,
  alternateHref,
  children,
}: AuthSplitPanelProps) {
  return (
    <div className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(13,92,69,0.12)] lg:h-[520px] lg:grid-cols-2">
      <aside className="flex min-h-0 flex-col bg-primary px-8 py-8 text-white sm:px-9">
        <Link
          href={ROUTES.home}
          className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white">
            <Image
              src={APP_LOGO_SRC}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </Link>

        <div className="mt-10 max-w-sm">
          <h2 className="text-[1.7rem] font-bold leading-[1.15] tracking-[-0.03em]">
            Transform AI text into natural, human writing
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Join writers who use RefinoText to revise AI-assisted drafts for
            clarity, tone, and readability.
          </p>
        </div>

        <div className="mt-auto pt-8">
          <p className="text-xs text-white/70">Trusted by writers worldwide</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {TRUST_MARKS.map((mark) => (
              <li key={mark.name}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <Image
                    src={mark.src}
                    alt={mark.name}
                    width={22}
                    height={22}
                    className="h-5 w-5 object-contain"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col overflow-y-auto px-6 py-7 sm:px-8">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>

        <div className="mt-4">{children}</div>

        <p className="mt-4 text-xs leading-5 text-muted">
          By continuing, you agree to our{" "}
          <Link href={ROUTES.terms} className="font-medium text-primary hover:underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link href={ROUTES.privacy} className="font-medium text-primary hover:underline">
            Privacy Policy
          </Link>
          , and{" "}
          <Link
            href={ROUTES.acceptableUse}
            className="font-medium text-primary hover:underline"
          >
            Responsible Use
          </Link>
          .
        </p>

        <ul className="mt-4 space-y-3">
          {PERKS.map((perk) => (
            <li key={perk.title} className="flex gap-3">
              <perk.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {perk.title}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {perk.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-muted">
          {alternatePrompt}{" "}
          <Link href={alternateHref} className="font-semibold text-primary hover:underline">
            {alternateLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
