"use client";

import { Show, useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Briefcase,
  Check,
  Coffee,
  Copy,
  ChevronDown,
  Download,
  GraduationCap,
  Heart,
  Keyboard,
  Lightbulb,
  Loader2,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { isClerkEnabled } from "@/lib/auth-config";
import { APP_LOGO_SRC, ROUTES } from "@/lib/constants";
import { countWords, HUMANIZER_ERRORS } from "@/lib/humanizer";
import type { ApiErrorResponse, HumanizeResponse } from "@/types";
import { HumanizedOutputView } from "./humanized-output-view";
import { humanizerEditorTextClassName } from "./humanizer-editor-styles";

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
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [style, setStyle] = useState<EditorStyleId>("auto");
  const [ultraMode, setUltraMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState<"input" | "output" | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  const inputWordCount = countWords(input);

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

    const text = input.trim();
    if (!text) {
      setError(HUMANIZER_ERRORS.empty);
      return;
    }

    setError(null);
    setOutput("");
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
          tone: style === "auto" ? undefined : style,
        }),
      });

      const data = (await res.json()) as HumanizeResponse | ApiErrorResponse;

      if (!res.ok) {
        const apiError = data as ApiErrorResponse;
        if (apiError.code === "NO_WIKIPEDIA_MATCH") {
          setError(null);
          return;
        }
        setError(apiError.error || "Humanization failed. Please try again.");
        return;
      }

      requestIdRef.current = null;
      requestKeyRef.current = null;
      const result = data as HumanizeResponse;
      setOutput(result.output);
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
    }
  }, [input, isSignedIn, style]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key === "Enter" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        handleRefine();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRefine]);

  const handleCopy = async (source: "input" | "output") => {
    const text = source === "input" ? input : output;
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
    const text = source === "input" ? input : output;
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
        setInput(result);
        notifyStatus(`Uploaded "${file.name}" (${countWords(result)} words)`);
      }
    };

    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClear = () => {
    setInput("");
    setOutput("");
    setError(null);
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

      <div className="overflow-hidden rounded-2xl border-2 border-border/75 bg-transparent">
        <div className="flex items-center justify-between gap-3 border-b-2 border-border/70 px-4 py-3">
          <div
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label="Writing style"
          >
            {EDITOR_STYLES.map(({ id, label, Icon }) => {
              const selected = style === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setStyle(id)}
                  className={
                    selected
                      ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-dark px-3.5 py-1.5 text-xs font-medium tracking-tight text-foreground"
                      : "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-tight text-foreground transition-colors duration-150 hover:bg-mint-dark/60"
                  }
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
              aria-haspopup="listbox"
              aria-label="Engine version REFV4.5 beta"
            >
              <span>REFV4.5</span>
              <span className="rounded-md bg-accent-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Beta
              </span>
              <ChevronDown className="h-4 w-4 text-foreground" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => setUltraMode((current) => !current)}
              aria-pressed={ultraMode}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                ultraMode
                  ? "text-primary"
                  : "text-foreground hover:text-foreground/80"
              }`}
            >
              <Zap className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Ultra Mode</span>
            </button>
          </div>
        </div>

        <div className="grid min-h-[min(70vh,640px)] gap-3 p-3 sm:grid-cols-2">
          <section className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border-2 border-border/65 bg-[#f9fafb] sm:min-h-0 sm:h-full">
            <div className="relative flex min-h-0 flex-1 flex-col">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Input text"
                placeholder="For optimal results, we recommend using at least 250 words."
                className={`min-h-0 flex-1 resize-none px-4 pb-14 pt-4 ${humanizerEditorTextClassName}`}
              />

              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
                <span className="rounded-full border border-border/70 bg-white/95 px-2.5 py-1 font-mono text-xs text-[#374151] shadow-sm">
                  {inputWordCount} words
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-white/95 px-3 py-1.5 font-mono text-xs text-[#6b7280] shadow-sm">
                  <Keyboard className="h-3.5 w-3.5" aria-hidden />
                  Press Ctrl+Enter to humanize
                </span>
              </div>
            </div>

            <div className="border-t-2 border-border/60">
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

              <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-white/70 px-4 py-3">
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        className="inline-flex items-center rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground"
                      >
                        Humanize
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        onClick={handleRefine}
                        disabled={!input.trim() || isProcessing}
                        className="inline-flex items-center gap-1.5 rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground disabled:opacity-50"
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-mint-dark/80 px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-mint-dark hover:text-foreground disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {isProcessing ? "Humanizing..." : "Humanize"}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border-2 border-border/65 bg-[#f9fafb] sm:min-h-0 sm:h-full">
            {output.trim() ? (
              <>
                <div className="flex items-center justify-end gap-1 border-b-2 border-border/60 px-3 py-2">
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
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <HumanizedOutputView text={output} />
                </div>
              </>
            ) : null}

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
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
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
      </div>
    </div>
  );
}
