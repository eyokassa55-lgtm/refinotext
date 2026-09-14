import { previewPlainText } from "@/lib/editor-html";

export type EditorVersion = {
  id: string;
  createdAt: string;
  inputHtml: string;
  outputHtml: string;
  preview: string;
};

export const EDITOR_VERSIONS_STORAGE_KEY = "refinotext:editor-versions";
export const MAX_EDITOR_VERSIONS = 25;

export function readEditorVersions(): EditorVersion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EDITOR_VERSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EditorVersion[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.inputHtml === "string" &&
        typeof item.outputHtml === "string",
    );
  } catch {
    return [];
  }
}

export function writeEditorVersions(versions: EditorVersion[]): void {
  window.localStorage.setItem(
    EDITOR_VERSIONS_STORAGE_KEY,
    JSON.stringify(versions.slice(0, MAX_EDITOR_VERSIONS)),
  );
}

export function createEditorVersion(input: {
  inputHtml: string;
  outputHtml: string;
  previewSource: string;
}): EditorVersion {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    inputHtml: input.inputHtml,
    outputHtml: input.outputHtml,
    preview: previewPlainText(input.previewSource) || "Empty draft",
  };
}
