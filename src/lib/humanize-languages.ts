export const HUMANIZE_LANGUAGES = [
  { id: "en", code: "EN", nativeName: "English", englishName: "English" },
  { id: "es", code: "ES", nativeName: "Español", englishName: "Spanish" },
  { id: "fr", code: "FR", nativeName: "Français", englishName: "French" },
  { id: "de", code: "DE", nativeName: "Deutsch", englishName: "German" },
  { id: "pt", code: "PT", nativeName: "Português", englishName: "Portuguese" },
  { id: "ja", code: "JA", nativeName: "日本語", englishName: "Japanese" },
  { id: "zh", code: "ZH", nativeName: "中文", englishName: "Chinese" },
] as const;

export type HumanizeLanguageId = (typeof HUMANIZE_LANGUAGES)[number]["id"];

export const HUMANIZE_LANGUAGE_IDS = HUMANIZE_LANGUAGES.map(
  (language) => language.id,
) as [HumanizeLanguageId, ...HumanizeLanguageId[]];

export const DEFAULT_HUMANIZE_LANGUAGE: HumanizeLanguageId = "en";

export type HumanizeLanguage = (typeof HUMANIZE_LANGUAGES)[number];

export function resolveHumanizeLanguage(
  id?: string | null,
): HumanizeLanguage {
  const key = id?.trim().toLowerCase();
  return (
    HUMANIZE_LANGUAGES.find((language) => language.id === key) ??
    HUMANIZE_LANGUAGES[0]
  );
}
