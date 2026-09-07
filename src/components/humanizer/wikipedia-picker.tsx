"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WikipediaListItem = {
  id: number;
  topic: string;
  category: string;
};

type WikipediaArticle = WikipediaListItem & {
  source_url: string;
  source_text: string;
};

type WikipediaPickerProps = {
  onLoad: (article: WikipediaArticle) => void;
  disabled?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  geography: "Geography",
  history: "History",
  economics: "Economics",
  civics: "Civics",
  technology: "Technology",
  environment: "Environment",
  sports: "Sports",
  education: "Education",
  culture: "Culture",
  general: "General",
};

export function WikipediaPicker({ onLoad, disabled }: WikipediaPickerProps) {
  const [articles, setArticles] = useState<WikipediaListItem[]>([]);
  const [category, setCategory] = useState("all");
  const [articleId, setArticleId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wikipedia")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load Wikipedia samples.");
        return res.json() as Promise<{ articles: WikipediaListItem[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setArticles(data.articles ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Wikipedia samples.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = [...new Set(articles.map((article) => article.category))];
    unique.sort((left, right) => left.localeCompare(right));
    return unique;
  }, [articles]);

  const filtered = useMemo(() => {
    const rows =
      category === "all"
        ? articles
        : articles.filter((article) => article.category === category);
    return [...rows].sort((left, right) => left.topic.localeCompare(right.topic));
  }, [articles, category]);

  const handleLoad = async () => {
    if (!articleId || disabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wikipedia?id=${encodeURIComponent(articleId)}`);
      if (!res.ok) throw new Error("Could not load that Wikipedia article.");
      const article = (await res.json()) as WikipediaArticle;
      onLoad(article);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load that Wikipedia article.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-4 mt-4 rounded-xl border border-border bg-mint-dark/20 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-accent" aria-hidden />
        Wikipedia samples
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="wikipedia-category">
          Category
        </label>
        <select
          id="wikipedia-category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setArticleId("");
          }}
          disabled={disabled || articles.length === 0}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:max-w-[11rem]"
        >
          <option value="all">All topics</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value] ?? value}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="wikipedia-article">
          Article
        </label>
        <select
          id="wikipedia-article"
          value={articleId}
          onChange={(event) => setArticleId(event.target.value)}
          disabled={disabled || filtered.length === 0}
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">Choose an article</option>
          {filtered.map((article) => (
            <option key={article.id} value={String(article.id)}>
              {article.topic}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleLoad()}
          disabled={disabled || isLoading || !articleId}
          className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isLoading ? "Loading…" : "Load into editor"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Loads a Wikipedia excerpt. Humanize returns the article for that same topic. Sign-in is required.
      </p>
    </div>
  );
}
