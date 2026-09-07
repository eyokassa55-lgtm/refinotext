import { NextResponse, type NextRequest } from "next/server";

import { getWikipediaArticle, listWikipediaArticles } from "@/lib/wikipedia-corpus";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam !== null) {
    const id = Number.parseInt(idParam, 10);
    if (!Number.isInteger(id) || id < 0) {
      return NextResponse.json({ error: "Invalid article id.", code: "INVALID_ID" }, { status: 400 });
    }
    const article = getWikipediaArticle(id);
    if (!article) {
      return NextResponse.json({ error: "Article not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(article);
  }

  return NextResponse.json({ articles: listWikipediaArticles() });
}
