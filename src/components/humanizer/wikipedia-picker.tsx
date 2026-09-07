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

  const handleLoad = async () => {
    const topic = query.trim();
    if (!topic || disabled) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/wikipedia?q=${encodeURIComponent(topic)}`);
      if (!res.ok) return;
      const article = (await res.json()) as WikipediaArticle;
      onLoad(article);
    } catch {
      // Keep the editor size unchanged; failed searches stay in the same row.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className="flex items-center gap-2 border-b border-border px-4 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        void handleLoad();
      }}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
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
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-foreground placeholder:text-muted/70 focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || isLoading || !query.trim()}
        className="shrink-0 text-xs font-semibold text-foreground disabled:opacity-40"
      >
        {isLoading ? "Loading…" : "Load"}
      </button>
    </form>
  );
}
