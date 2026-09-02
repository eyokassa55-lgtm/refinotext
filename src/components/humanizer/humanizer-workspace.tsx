"use client";

import { Show, useAuth } from "@clerk/nextjs";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { isClerkEnabled } from "@/lib/auth-config";
import { ROUTES } from "@/lib/constants";
import { countWords, HUMANIZER_ERRORS } from "@/lib/humanizer";
import { looksLikeGenericEssay } from "@/lib/humanize-voice";
import { cn } from "@/lib/utils";
import type { ApiErrorResponse, HumanizeResponse } from "@/types";
import { HumanizerControls } from "./humanizer-controls";
import { READABILITY_LEVELS } from "@/lib/landing-data";

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
  const [tone, setTone] = useState("standard");
  const [intensity, setIntensity] = useState(75);
  const [readability, setReadability] = useState<string>(READABILITY_LEVELS[1]);
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
  const showConversationalHint =
    looksLikeGenericEssay(input) && (tone === "standard" || tone === "academic");
  const outputWordCount = countWords(output);

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

    // Fresh id on every click so Humanize always uses the current tone/level/intensity.
    requestIdRef.current = crypto.randomUUID();
    requestKeyRef.current = `${text}\0${tone}\0${readability}\0${intensity}`;

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          tone,
          readability,
          intensity,
          requestId: requestIdRef.current,
        }),
      });

      const data = (await res.json()) as HumanizeResponse | ApiErrorResponse;

      if (!res.ok) {
        const apiError = data as ApiErrorResponse;
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
  }, [input, intensity, isSignedIn, readability, tone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
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

  const handleClear = () => {
    setInput("");
    setOutput("");
    setError(null);
    notifyStatus("Cleared editor");
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

  const requireAuthButtonClass =
    "rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground";

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt,.text,.md,.markdown,.doc,.docx,.pdf"
        className="hidden"
      />

      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {(statusMsg || error) && (
          <div
            className={cn(
              "mx-4 mt-4 rounded-xl border px-4 py-2 text-xs font-medium",
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-accent/20 bg-accent-light/80 text-primary",
            )}
          >
            {error ?? statusMsg}
          </div>
        )}

        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div className="relative flex min-h-[280px] flex-col p-4 lg:pr-3">
            <div
              className="pointer-events-none absolute bottom-5 right-0 top-5 hidden w-px rounded-full bg-border lg:block"
              aria-hidden
            />

            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h3 className="text-sm font-semibold text-foreground">Input Text</h3>
              <div className="flex items-center gap-2">
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        title="Sign in to upload"
                        className={requireAuthButtonClass}
                      >
                        <UploadCloud className="h-4 w-4" />
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        title="Upload document"
                        onClick={() => fileInputRef.current?.click()}
                        className={requireAuthButtonClass}
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
                    className={requireAuthButtonClass}
                  >
                    <UploadCloud className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Clear text"
                  onClick={handleClear}
                  disabled={!input.trim() && !output.trim()}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  title="Copy input"
                  onClick={() => handleCopy("input")}
                  disabled={!input.trim()}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
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
                        className={requireAuthButtonClass}
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
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
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
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <span className="text-xs text-muted">
                  {inputWordCount} words · {input.length} chars
                </span>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-[#f8f9fa]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Input text"
                placeholder="For optimal results, we recommend using at least 250 words."
                className="min-h-[200px] flex-1 resize-none bg-transparent px-5 py-4 text-base leading-relaxed text-foreground placeholder:text-muted/70 focus-visible:outline-none lg:min-h-0"
              />
            </div>
          </div>

          <div className="flex min-h-[280px] flex-col border-t border-border p-4 lg:border-t-0 lg:pl-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h3 className="text-sm font-semibold text-foreground">
                Humanized Output
              </h3>
              <div className="flex items-center gap-1">
                {isClerkEnabled ? (
                  <>
                    <Show when="signed-out">
                      <Link
                        href={ROUTES.signIn}
                        title="Sign in to download"
                        className={requireAuthButtonClass}
                      >
                        <Download className="h-4 w-4" />
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <button
                        type="button"
                        title="Download output"
                        onClick={() => handleDownload("output")}
                        disabled={!output.trim()}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
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
                    disabled={!output.trim()}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Copy output"
                  onClick={() => handleCopy("output")}
                  disabled={!output.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-mint-dark/60 hover:text-foreground disabled:opacity-40"
                >
                  {copied === "output" ? (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === "output" ? "Copied" : "Copy"}
                </button>
                {(outputWordCount > 0 || output.length > 0) && (
                  <span className="ml-1 text-xs text-muted">
                    {outputWordCount} words · {output.length} chars
                  </span>
                )}
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-mint-dark/15">
              <textarea
                readOnly
                value={output}
                aria-label="Humanized output"
                className="min-h-[200px] flex-1 resize-none bg-transparent px-5 py-4 text-base leading-relaxed text-foreground focus-visible:outline-none lg:min-h-0"
              />

              {isProcessing && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-card/85"
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
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint-dark/50 text-accent">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <p className="text-base font-semibold text-foreground/80">
                    Your humanized text will appear here
                  </p>
                  <p className="mt-2 max-w-xs text-sm text-muted">
                    {isSignedIn
                      ? "Paste your draft, choose settings, then click Humanize"
                      : "Sign in first, then paste your draft and humanize"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConversationalHint ? (
        <p className="rounded-lg border border-border bg-mint-dark/40 px-3 py-2 text-xs leading-relaxed text-muted">
          This draft reads like a generic topic essay. For a more natural rhythm, try{" "}
          <button
            type="button"
            onClick={() => setTone("conversational")}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Conversational
          </button>{" "}
          tone. Intensity does not need to be at 100%.
        </p>
      ) : null}

      <HumanizerControls
        tone={tone}
        onToneChange={setTone}
        intensity={intensity}
        onIntensityChange={setIntensity}
        readability={readability}
        onReadabilityChange={setReadability}
        onRefine={handleRefine}
        isLoading={isProcessing}
        disabled={!input.trim()}
      />
    </div>
  );
}
