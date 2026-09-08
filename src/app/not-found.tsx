import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <BrandLogo showWordmark={false} size={112} className="mb-6" />
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-muted">
        That page does not exist. Head back to the home page to keep writing.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold tracking-tight text-primary-foreground shadow-[0_1px_2px_rgba(13,92,69,0.18),0_8px_20px_rgba(13,92,69,0.16)] hover:bg-primary-hover"
      >
        Go home
      </Link>
    </main>
  );
}
