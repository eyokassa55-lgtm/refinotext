"use client";

import { Show, useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Briefcase,
  Check,
  Coffee,
  Copy,
  Download,
  GraduationCap,
  Heart,
  Lightbulb,
  Loader2,
  Lock,
  UploadCloud,
  Wand2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCreditBalance } from "@/hooks/use-credit-balance";
import { useHumanizeLanguage } from "@/hooks/use-humanize-language";
import { isClerkEnabled } from "@/lib/auth-config";
import { APP_LOGO_SRC, ROUTES } from "@/lib/constants";
import {
  createEditorVersion,
  readEditorVersions,
  writeEditorVersions,
  type EditorVersion,
} from "@/lib/editor-versions";
import { DEFAULT_HUMANIZE_DETECTOR, type HumanizeDetectorId } from "@/lib/humanize-detectors";
import { hasPaidHumanizerAccess, isPaidHumanizeLanguage } from "@/lib/humanize-access";
import { countWords, HUMANIZER_ERRORS } from "@/lib/humanizer";
import type { ApiErrorResponse, HumanizeResponse } from "@/types";
import type { Editor } from "@tiptap/react";
import { HumanizerDetectorTargets } from "./humanizer-detector-targets";
import { HumanizerEditorToolbar, type EditorDocStatus } from "./humanizer-editor-toolbar";
import { HumanizerRichEditor, type HumanizerRichEditorHandle } from "./humanizer-rich-editor";
import { HumanizerVersionHistory } from "./humanizer-version-history";
import { LanguagePicker } from "./language-picker";

const EDITOR_STYLES = [
  { id: "auto", label: "Auto", Icon: Wand2 },
  { id: "academic", label: "Academic", Icon: BookOpen },
  { id: "professional", label: "Professional", Icon: Briefcase },
  { id: "friendly", label: "Friendly", Icon: Heart },
  { id: "formal", label: "Formal", Icon: GraduationCap },
  { id: "casual", label: "Casual", Icon: Coffee },
  { id: "creative", label: "Creative", Icon: Lightbulb },
] as const;

type EditorStyleId = (typeof EDITOR_STYLES)[number]["id"];

export function HumanizerWorkspace() {
  if (!isClerkEnabled) {
    return <HumanizerWorkspaceInner isSignedIn />;
  }

  return <HumanizerWorkspaceWithAuth />;
}

function HumanizerWorkspaceWithAuth() {
  const { isSignedIn } = useAuth();
  return <HumanizerWorkspaceInner isSignedIn={Boolean(isSignedIn)} />;
}

function HumanizerWorkspaceInner({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter();
  const { credits } = useCreditBalance(isSignedIn && isClerkEnabled);
  const paidUnlocked = hasPaidHumanizerAccess(credits?.plan);
  const { language, setLanguage } = useHumanizeLanguage();

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [style, setStyle] = useState<EditorStyleId>("auto");
  const [detector, setDetector] = useState<HumanizeDetectorId>(DEFAULT_HUMANIZE_DETECTOR);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState<"input" | "output" | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputEditor, setInputEditor] = useState<Editor | null>(null);
  const [docStatus, setDocStatus] = useState<EditorDocStatus>("ready");
  const [versions, setVersions] = useState<EditorVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const inputEditorRef = useRef<HumanizerRichEditorHandle>(null);
  const outputEditorRef = useRef<HumanizerRichEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  const inputWordCount = countWords(input);
  const upgradeHref = isSignedIn ? ROUTES.pricing : ROUTES.signIn;
  const skipStatusRef = useRef(false);

  useEffect(() => {
    setVersions(readEditorVersions());
  }, []);

  useEffect(() => {
    if (docStatus !== "saved") return;
    const timer = window.setTimeout(() => setDocStatus("ready"), 2000);
    return () => window.clearTimeout(timer);
  }, [docStatus]);

  useEffect(() => {
    if (paidUnlocked) return;
    if (style !== "auto") setStyle("auto");
    if (isPaidHumanizeLanguage(language)) setLanguage("en");
  }, [language, paidUnlocked, setLanguage, style]);

  const notifyStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleRefine = useCallback(async () => {
    if (isProcessingRef.current) return;

    if (!isSignedIn) {
      setError("Sign in required to humanize text.");
      return;
    }

    const text = (inputEditorRef.current?.getText() ?? input).trim();
    if (!text) {
      setError(HUMANIZER_ERRORS.empty);
      return;
    }

    if (isPaidHumanizeLanguage(language) && !paidUnlocked) {
      notifyStatus("Upgrade to unlock this language.");
      router.push(upgradeHref);
      return;
    }

    setError(null);
    skipStatusRef.current = true;
    outputEditorRef.current?.clear();
    skipStatusRef.current = false;
    setOutput("");
    setDocStatus("humanizing");
    isProcessingRef.current = true;
    setIsProcessing(true);

    requestIdRef.current = crypto.randomUUID();
    requestKeyRef.current = text;

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          requestId: requestIdRef.current,
          language,
          tone: style === "auto" ? undefined : style,
          detector,
        }),
      });

      const raw = await res.text();
      let data: HumanizeResponse | ApiErrorResponse | null = null;
      try {
        data = raw ? (JSON.parse(raw) as HumanizeResponse | ApiErrorResponse) : null;
      } catch {
        setError(
          res.status >= 500
            ? "The humanizer timed out or hit a server error. Please try again."
            : "The humanizer returned an unexpected response. Please try again.",
        );
        return;
      }

      if (!res.ok) {
        const apiError = (data ?? {}) as ApiErrorResponse;
        if (apiError.code === "NO_WIKIPEDIA_MATCH") {
          setError(null);
          return;
        }
        if (apiError.code === "PAID_FEATURE") {
          setError(apiError.error || "Upgrade to unlock this feature.");
          router.push(ROUTES.pricing);
          return;
        }
        setError(apiError.error || "Humanization failed. Please try again.");
        return;
      }

      if (!data || !("output" in data) || typeof data.output !== "string") {
        setError("The humanizer returned an empty response. Please try again.");
        return;
      }

      requestIdRef.current = null;
      requestKeyRef.current = null;
      const result = data as HumanizeResponse;
      skipStatusRef.current = true;
      outputEditorRef.current?.setHumanizedText(result.output);
      skipStatusRef.current = false;
      setOutput(result.output);
      setDocStatus("ready");
      notifyStatus(
        result.creditsCharged > 0
          ? `Humanized ${result.wordCount} words. ${result.creditsCharged} credits used.`
          : "Humanized (no extra credits charged).",
      );
      window.dispatchEvent(new Event("refinotext:credits-updated"));
    } catch {
      setError("Could not reach the humanizer API. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setDocStatus((current) => (current === "humanizing" ? "ready" : current));
    }
  }, [detector, input, isSignedIn, language, paidUnlocked, router, style, upgradeHref]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key === "Enter" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        handleRefine();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleRefine]);

  const handleInputTextChange = (text: string) => {
    setInput(text);
    if (!skipStatusRef.current && !isProcessingRef.current) {
      setDocStatus("unsaved");
    }
  };

  const handleOutputTextChange = (text: string) => {
    setOutput(text);
    if (!skipStatusRef.current && !isProcessingRef.current) {
      setDocStatus("unsaved");
    }
  };

  const handleSaveVersion = () => {
    if (!input.trim() && !output.trim()) return;
    const version = createEditorVersion({
      inputHtml: inputEditorRef.current?.getHtml() ?? "",
      outputHtml: outputEditorRef.current?.getHtml() ?? "",
      previewSource: input || output,
    });
    const next = [version, ...versions];
    writeEditorVersions(next);
    setVersions(next);
    setDocStatus("saved");
    notifyStatus("Version saved");
  };

  const handleRestoreVersion = (version: EditorVersion) => {
    skipStatusRef.current = true;
    inputEditorRef.current?.setHtml(version.inputHtml);
    outputEditorRef.current?.setHtml(version.outputHtml);
    skipStatusRef.current = false;
    setHistoryOpen(false);
    setDocStatus("ready");
    notifyStatus("Version restored");
  };

  const handleDeleteVersion = (id: string) => {
    const next = versions.filter((version) => version.id !== id);
    writeEditorVersions(next);
    setVersions(next);
  };

  const handleStyleClick = (id: EditorStyleId) => {
    if (id === "auto" || paidUnlocked) {
      setStyle(id);
      return;
    }
    notifyStatus("Upgrade to unlock this writing style.");
    router.push(upgradeHref);
  };

  const handleCopy = async (source: "input" | "output") => {
    const text =
      source === "input"
        ? (inputEditorRef.current?.getText() ?? input)
        : (outputEditorRef.current?.getText() ?? output);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(source);
      notifyStatus(
        source === "output" ? "Copied humanized output" : "Copied input text",
      );
      setTimeout(() => setCopied(null), 2000);
    } catch {
      notifyStatus(HUMANIZER_ERRORS.copy);
    }
  };

  const handleDownload = (source: "input" | "output") => {
    if (!isSignedIn) return;
    const text =
      source === "input"
        ? (inputEditorRef.current?.getText() ?? input)
        : (outputEditorRef.current?.getText() ?? output);
    if (!text.trim()) return;
    const filename =
      source === "output" ? "refinotext-humanized.txt" : "refinotext-draft.txt";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    notifyStatus(`Downloaded ${filename}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSignedIn) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        skipStatusRef.current = true;
        inputEditorRef.current?.setText(result);
        skipStatusRef.current = false;
        setDocStatus("unsaved");
        notifyStatus(`Uploaded "${file.name}" (${countWords(result)} words)`);
      }
    };

    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClear = () => {
    skipStatusRef.current = true;
    inputEditorRef.current?.clear();
    outputEditorRef.current?.clear();
    skipStatusRef.current = false;
    setError(null);
    setDocStatus("ready");
    notifyStatus("Cleared editor");
  };

  const iconButtonClass =
    "rounded-md p-1 text-foreground transition-colors duration-150 hover:text-foreground/80";

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt,.text,.md,.markdown,.doc,.docx,.pdf"
        className="hidden"
      />

      <div className="relative overflow-visible rounded-2xl border-2 border-border/75 bg-transparent lg:overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b-2 border-border/70 px-4 py-3">
          <div
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label="Writing style"
          >
            {EDITOR_STYLES.map(({ id, label, Icon }) => {
              const selected = style === id;
              const locked = id !== "auto" && !paidUnlocked;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={locked ? `${label} (locked — upgrade to unlock)` : label}
                  title={locked ? "Upgrade to unlock this style" : label}
                  onClick={() => handleStyleClick(id)}
                  className={
                    selected
                      ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-dark px-3.5 py-1.5 text-xs font-medium tracking-tight text-foreground"
                      : "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-tight text-foreground transition-colors duration-150 hover:bg-mint-dark/60"
                  }
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                  {locked ? <Lock className="h-3 w-3 opacity-70" aria-hidden /> : null}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <LanguagePicker value={language} onChange={setLanguage} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 lg:h-[min(72vh,680px)] lg:grid-cols-2 lg:overflow-hidden">
          <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border-2 border-border/65 bg-[#f9fafb] lg:min-h-0">
            <div className="relative flex min-h-[14rem] flex-1 flex-col lg:min-h-0">
              <HumanizerRichEditor
                ref={inputEditorRef}
                ariaLabel="Input text"
                placeholder="For optimal results, we recommend using at least 250 words."
                onTextChange={handleInputTextChange}
                onEditor={setInputEditor}
              />
            </div>

            <div className="border-t-2 border-border/60 shrink-0 bg-white/80">
              <div className="flex items-center gap-2 px-3 py-2">
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        title="Sign in to upload"
                        className="rounded-lg bg-mint-dark/70 p-2 text-foreground transition-colors hover:bg-mint-dark hover:text-foreground"
                      >
                        <UploadCloud className="h-4 w-4" />
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        title="Upload document"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg bg-mint-dark/70 p-2 text-foreground transition-colors hover:bg-mint-dark hover:text-foreground"
                      >
                        <UploadCloud className="h-4 w-4" />
                      </button>
                    </Show>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Upload document"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-mint-dark/70 p-2 text-foreground transition-colors hover:bg-mint-dark hover:text-foreground"
                  >
                    <UploadCloud className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!input.trim() && !output.trim()}
                  className="px-1 text-sm font-medium text-foreground transition-colors hover:text-foreground/80 disabled:opacity-40"
                >
                  Clear
                </button>
                <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 font-mono text-xs text-[#374151]">
                  {inputWordCount} words
                </span>
                <button
                  type="button"
                  title="Copy input"
                  onClick={() => handleCopy("input")}
                  disabled={!input.trim()}
                  className={`${iconButtonClass} disabled:opacity-40`}
                >
                  {copied === "input" ? (
                    <Check className="h-4 w-4 text-accent" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        title="Sign in to download"
                        className={iconButtonClass}
                      >
                        <Download className="h-4 w-4" />
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        title="Download draft"
                        onClick={() => handleDownload("input")}
                        disabled={!input.trim()}
                        className={`${iconButtonClass} disabled:opacity-40`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </Show>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Download draft"
                    onClick={() => handleDownload("input")}
                    disabled={!input.trim()}
                    className={`${iconButtonClass} disabled:opacity-40`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-border/50 bg-white/70 px-3 py-2.5 sm:gap-3 sm:px-4">
                <HumanizerDetectorTargets value={detector} onChange={setDetector} />
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        className="inline-flex shrink-0 items-center rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground"
                      >
                        Humanize
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        onClick={handleRefine}
                        disabled={!input.trim() || isProcessing}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : null}
                        {isProcessing ? "Humanizing..." : "Humanize"}
                      </button>
                    </Show>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={!input.trim() || isProcessing}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {isProcessing ? "Humanizing..." : "Humanize"}
                  </button>
                )}
              </div>

              <HumanizerEditorToolbar
                editor={inputEditor}
                status={isProcessing ? "humanizing" : docStatus}
                onSaveVersion={handleSaveVersion}
                onOpenHistory={() => setHistoryOpen(true)}
                canSave={Boolean(input.trim() || output.trim())}
              />
            </div>
          </section>

          <section className="relative flex min-h-[20rem] flex-col overflow-hidden rounded-2xl border-2 border-border/65 bg-white lg:min-h-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {output.trim() ? (
                <div className="flex shrink-0 items-center justify-end gap-1 border-b-2 border-border/60 px-3 py-2">
                  <button
                    type="button"
                    title="Copy output"
                    onClick={() => handleCopy("output")}
                    className={iconButtonClass}
                  >
                    {copied === "output" ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  {isClerkEnabled ? (
                    <>
                      <Show when="signed-out">
                        <Link
                          href={ROUTES.signIn}
                          title="Sign in to download"
                          className={iconButtonClass}
                        >
                          <Download className="h-4 w-4" />
                        </Link>
                      </Show>
                      <Show when="signed-in">
                        <button
                          type="button"
                          title="Download output"
                          onClick={() => handleDownload("output")}
                          className={iconButtonClass}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </Show>
                    </>
                  ) : (
                    <button
                      type="button"
                      title="Download output"
                      onClick={() => handleDownload("output")}
                      className={iconButtonClass}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : null}

              <HumanizerRichEditor
                ref={outputEditorRef}
                variant="output"
                ariaLabel="Humanized output"
                onTextChange={handleOutputTextChange}
              />
            </div>

            {isProcessing && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/90 backdrop-blur-[2px]"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  Humanizing your draft…
                </p>
              </div>
            )}

            {!output && !isProcessing && (
              <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-white px-6 text-center">
                <Image
                  src={APP_LOGO_SRC}
                  alt=""
                  width={128}
                  height={128}
                  sizes="112px"
                  quality={100}
                  className="mb-4 h-28 w-28 scale-[1.45] object-contain bg-transparent opacity-[0.14]"
                />
                {error ? (
                  <p className="max-w-xs text-sm text-red-600">{error}</p>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-foreground/85">
                      Your humanized text will appear here
                    </p>
                    <p className="mt-2 text-sm font-medium text-muted/70">
                      Paste text on the left and click Humanize
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {statusMsg ? (
          <p className="border-t-2 border-border/60 px-4 py-2 text-center text-xs text-muted/70" role="status">
            {statusMsg}
          </p>
        ) : null}

        <HumanizerVersionHistory
          open={historyOpen}
          versions={versions}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
        />
      </div>
    </div>
  );
}
