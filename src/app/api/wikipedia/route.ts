import { NextResponse, type NextRequest } from "next/server";

import { lookupWikipediaArticle } from "@/lib/wikipedia-corpus";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json(
      { error: "Add a Wikipedia topic to search.", code: "MISSING_QUERY" },
      { status: 400 },
    );
  }

  const article = await lookupWikipediaArticle(query);
  if (!article) {
    return NextResponse.json({ error: "Article not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(article);
}
