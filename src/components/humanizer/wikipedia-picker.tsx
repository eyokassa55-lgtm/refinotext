"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";

type WikipediaArticle = {
  id: number;
  topic: string;
  category: string;
  source_url: string;
  source_text: string;
};

type WikipediaPickerProps = {
  onLoad: (article: WikipediaArticle) => void;
  disabled?: boolean;
};

export function WikipediaPicker({ onLoad, disabled }: WikipediaPickerProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    const topic = query.trim();
    if (!topic || disabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wikipedia?q=${encodeURIComponent(topic)}`);
      if (!res.ok) throw new Error("Could not find that Wikipedia article.");
      const article = (await res.json()) as WikipediaArticle;
      onLoad(article);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not find that Wikipedia article.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-4 mt-4 rounded-xl border border-border bg-mint-dark/20 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-accent" aria-hidden />
        Wikipedia
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void handleLoad();
        }}
      >
        <label className="sr-only" htmlFor="wikipedia-query">
          Wikipedia topic
        </label>
        <input
          id="wikipedia-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder="Search any English Wikipedia topic"
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !query.trim()}
          className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isLoading ? "Loading…" : "Load into editor"}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Searches the full English Wikipedia. Humanize looks up the same topic as your draft. Sign-in is required.
      </p>
    </div>
  );
}
