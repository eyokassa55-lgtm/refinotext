const CRAWLER_USER_AGENT =
  /Googlebot|Google-InspectionTool|Storebot-Google|AdsBot-Google|Bingbot|bingbot|Slurp|DuckDuckBot|Baiduspider|Yandex(?:Bot|Images)|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|Pingdom|Lighthouse|Chrome-Lighthouse|GPTBot|ClaudeBot|Bytespider|SemrushBot|AhrefsBot/i;

export function isKnownCrawler(userAgent: string | null | undefined): boolean {
  return CRAWLER_USER_AGENT.test(userAgent ?? "");
}
