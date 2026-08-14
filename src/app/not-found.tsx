import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
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
        className="mt-8 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Go home
      </Link>
    </main>
  );
}
