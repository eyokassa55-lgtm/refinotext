"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle } from "react";

import { humanizePlainTextToHtml, plainTextToHtml } from "@/lib/editor-html";
import { createHumanizerExtensions } from "@/lib/humanizer-editor-extensions";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";

export type HumanizerRichEditorHandle = {
  getText: () => string;
  getHtml: () => string;
  setText: (text: string) => void;
  setHtml: (html: string) => void;
  setHumanizedText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  getEditor: () => Editor | null;
};

type HumanizerRichEditorProps = {
  placeholder?: string;
  className?: string;
  variant?: "input" | "output";
  ariaLabel: string;
  onTextChange: (text: string) => void;
  onEditor: (editor: Editor | null) => void;
  onFocusPane?: () => void;
};

function readPlainText(editor: Editor | null): string {
  if (!editor) return "";
  return editor.getText({ blockSeparator: "\n\n" });
}

export const HumanizerRichEditor = forwardRef<
  HumanizerRichEditorHandle,
  HumanizerRichEditorProps
>(function HumanizerRichEditor(
  {
    placeholder = "",
    className,
    variant = "input",
    ariaLabel,
    onTextChange,
    onEditor,
    onFocusPane,
  },
  ref,
) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: createHumanizerExtensions(placeholder),
    content: "",
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          variant === "output"
            ? "humanizer-prose humanizer-prose-output min-h-full px-6 py-6 sm:px-8 sm:py-7"
            : "humanizer-prose min-h-full px-4 pb-14 pt-4",
      },
    },
    onUpdate: ({ editor: current }) => {
      onTextChange(readPlainText(current));
    },
    onFocus: () => {
      onFocusPane?.();
    },
  });

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  useImperativeHandle(
    ref,
    () => ({
      getText: () => readPlainText(editor),
      getHtml: () => editor?.getHTML() ?? "",
      setText: (text: string) => {
        editor?.commands.setContent(plainTextToHtml(text), { emitUpdate: false });
        onTextChange(text);
      },
      setHtml: (html: string) => {
        editor?.commands.setContent(html || "<p></p>", { emitUpdate: false });
        onTextChange(readPlainText(editor));
      },
      setHumanizedText: (text: string) => {
        editor?.commands.setContent(humanizePlainTextToHtml(text), { emitUpdate: false });
        onTextChange(text);
      },
      clear: () => {
        editor?.commands.clearContent();
        onTextChange("");
      },
      focus: () => {
        editor?.commands.focus();
      },
      getEditor: () => editor,
    }),
    [editor, onTextChange],
  );

  return (
    <EditorContent
      editor={editor}
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
    />
  );
});
