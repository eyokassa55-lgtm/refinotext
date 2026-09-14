"use client";

import { Clock, RotateCcw, Trash2, X } from "lucide-react";

import type { EditorVersion } from "@/lib/editor-versions";

type HumanizerVersionHistoryProps = {
  open: boolean;
  versions: EditorVersion[];
  onClose: () => void;
  onRestore: (version: EditorVersion) => void;
  onDelete: (id: string) => void;
};

export function HumanizerVersionHistory({
  open,
  versions,
  onClose,
  onRestore,
  onDelete,
}: HumanizerVersionHistoryProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/20 p-3">
      <aside
        role="dialog"
        aria-label="Version history"
        className="flex h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_16px_50px_rgba(15,23,20,0.18)]"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" aria-hidden />
            Version history
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-mint-dark/70 hover:text-foreground"
            aria-label="Close version history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {versions.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted">
              No saved versions yet. Click Save Version to keep a snapshot of this draft.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="rounded-xl border border-border/70 bg-[#f9fafb] p-3"
                >
                  <p className="text-xs font-medium text-muted">
                    {new Date(version.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">
                    {version.preview}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestore(version)}
                      className="inline-flex items-center gap-1 rounded-full bg-mint-dark px-3 py-1 text-xs font-semibold text-foreground hover:bg-mint-dark/80"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(version.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-white hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
