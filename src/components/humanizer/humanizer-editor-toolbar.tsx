"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Clock,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Save,
  Strikethrough,
  Table,
  Underline,
} from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { sanitizeEditorUrl } from "@/lib/editor-html";
import { cn } from "@/lib/utils";

export type EditorDocStatus = "ready" | "unsaved" | "saved" | "humanizing" | "restoring";

type HumanizerEditorToolbarProps = {
  editor: Editor | null;
  status: EditorDocStatus;
  onSaveVersion: () => void;
  onOpenHistory: () => void;
  canSave: boolean;
};

const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Black", value: "#111111" },
  { label: "Gray", value: "#4b5563" },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#0d5c45" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Orange", value: "#c2410c" },
] as const;

const HIGHLIGHT_COLORS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Pink", value: "#fecaca" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Purple", value: "#e9d5ff" },
] as const;

const STATUS_LABEL: Record<EditorDocStatus, string> = {
  ready: "Ready",
  unsaved: "Unsaved",
  saved: "Saved",
  humanizing: "Humanizing",
  restoring: "Restoring",
};

export function HumanizerEditorToolbar({
  editor,
  status,
  onSaveVersion,
  onOpenHistory,
  canSave,
}: HumanizerEditorToolbarProps) {
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        strike: current.isActive("strike"),
        superscript: current.isActive("superscript"),
        subscript: current.isActive("subscript"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        link: current.isActive("link"),
        table: current.isActive("table"),
        paragraph: current.isActive("paragraph"),
        heading1: current.isActive("heading", { level: 1 }),
        heading2: current.isActive("heading", { level: 2 }),
        heading3: current.isActive("heading", { level: 3 }),
        blockquote: current.isActive("blockquote"),
        alignLeft: current.isActive({ textAlign: "left" }),
        alignCenter: current.isActive({ textAlign: "center" }),
        alignRight: current.isActive({ textAlign: "right" }),
        alignJustify: current.isActive({ textAlign: "justify" }),
        highlight: (current.getAttributes("highlight").color as string | undefined) ?? null,
        color: (current.getAttributes("textStyle").color as string | undefined) ?? null,
        href: (current.getAttributes("link").href as string | undefined) ?? "",
        canBullet: current.can().toggleBulletList(),
        canOrdered: current.can().toggleOrderedList(),
        canAddRow: current.can().addRowAfter(),
        canAddCol: current.can().addColumnAfter(),
        canDeleteTable: current.can().deleteTable(),
      };
    },
  });

  const paragraphLabel = snapshot?.heading1
    ? "Heading 1"
    : snapshot?.heading2
      ? "Heading 2"
      : snapshot?.heading3
        ? "Heading 3"
        : snapshot?.blockquote
          ? "Quote"
          : "Paragraph";

  return (
    <div className="border-b border-border/70 bg-white/90 px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-full border border-border/70 bg-white px-1.5 py-1">
          <MarkButton
            label="Bold"
            active={snapshot?.bold}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </MarkButton>
          <MarkButton
            label="Italic"
            active={snapshot?.italic}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </MarkButton>
          <MarkButton
            label="Underline"
            active={snapshot?.underline}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Underline className="h-3.5 w-3.5" />
          </MarkButton>
          <MarkButton
            label="Strikethrough"
            active={snapshot?.strike}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </MarkButton>

          <EditorMenu
            label="Text color"
            disabled={!editor}
            trigger={
              <span className="inline-flex items-center gap-0.5">
                <Palette className="h-3.5 w-3.5" />
                <span
                  className="h-1.5 w-3.5 rounded-full"
                  style={{ backgroundColor: snapshot?.color || "#111111" }}
                />
              </span>
            }
          >
            {TEXT_COLORS.map((color) => (
              <MenuRow
                key={color.label}
                label={color.label}
                active={
                  color.value === null ? !snapshot?.color : snapshot?.color === color.value
                }
                onClick={() => {
                  if (!editor) return;
                  if (!color.value) editor.chain().focus().unsetColor().run();
                  else editor.chain().focus().setColor(color.value).run();
                }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border/80"
                  style={{ backgroundColor: color.value || "#111111" }}
                />
              </MenuRow>
            ))}
          </EditorMenu>

          <EditorMenu
            label="Highlight"
            disabled={!editor}
            trigger={
              <span className="inline-flex items-center gap-0.5">
                <Highlighter className="h-3.5 w-3.5" />
                <span
                  className="h-1.5 w-3.5 rounded-full"
                  style={{ backgroundColor: snapshot?.highlight || "#e5e7eb" }}
                />
              </span>
            }
          >
            {HIGHLIGHT_COLORS.map((color) => (
              <MenuRow
                key={color.label}
                label={color.label}
                active={
                  color.value === null
                    ? !snapshot?.highlight
                    : snapshot?.highlight === color.value
                }
                onClick={() => {
                  if (!editor) return;
                  if (!color.value) editor.chain().focus().unsetHighlight().run();
                  else editor.chain().focus().toggleHighlight({ color: color.value }).run();
                }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-sm border border-border/80"
                  style={{ backgroundColor: color.value || "#ffffff" }}
                />
              </MenuRow>
            ))}
          </EditorMenu>

          <ToolbarDivider />

          <MarkButton
            label="Superscript"
            active={snapshot?.superscript}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
          >
            <span className="text-[11px] font-bold leading-none">
              x<sup>2</sup>
            </span>
          </MarkButton>
          <MarkButton
            label="Subscript"
            active={snapshot?.subscript}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
          >
            <span className="text-[11px] font-bold leading-none">
              x<sub>2</sub>
            </span>
          </MarkButton>

          <EditorMenu
            label="Lists"
            disabled={!editor}
            trigger={<List className="h-3.5 w-3.5" />}
          >
            <MenuRow
              label="Bullet list"
              active={snapshot?.bulletList}
              disabled={!snapshot?.canBullet}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="h-3.5 w-3.5" />
            </MenuRow>
            <MenuRow
              label="Numbered list"
              active={snapshot?.orderedList}
              disabled={!snapshot?.canOrdered}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </MenuRow>
          </EditorMenu>

          <LinkMenu editor={editor} active={Boolean(snapshot?.link)} href={snapshot?.href ?? ""} />

          <EditorMenu
            label="Table"
            disabled={!editor}
            trigger={<Table className="h-3.5 w-3.5" />}
          >
            <MenuRow
              label="Insert 3×3 table"
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            />
            <MenuRow
              label="Add row"
              disabled={!snapshot?.canAddRow}
              onClick={() => editor?.chain().focus().addRowAfter().run()}
            />
            <MenuRow
              label="Add column"
              disabled={!snapshot?.canAddCol}
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
            />
            <MenuRow
              label="Delete row"
              disabled={!snapshot?.table}
              onClick={() => editor?.chain().focus().deleteRow().run()}
            />
            <MenuRow
              label="Delete column"
              disabled={!snapshot?.table}
              onClick={() => editor?.chain().focus().deleteColumn().run()}
            />
            <MenuRow
              label="Delete table"
              disabled={!snapshot?.canDeleteTable}
              onClick={() => editor?.chain().focus().deleteTable().run()}
            />
          </EditorMenu>

          <EditorMenu
            label="Paragraph style"
            disabled={!editor}
            trigger={
              <span className="inline-flex items-center gap-1 px-0.5 text-xs font-semibold">
                T {paragraphLabel}
              </span>
            }
          >
            <MenuRow
              label="Paragraph"
              active={Boolean(snapshot?.paragraph) && !snapshot?.heading1 && !snapshot?.heading2 && !snapshot?.heading3}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />
            <MenuRow
              label="Heading 1"
              active={snapshot?.heading1}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <MenuRow
              label="Heading 2"
              active={snapshot?.heading2}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <MenuRow
              label="Heading 3"
              active={snapshot?.heading3}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            />
            <MenuRow
              label="Quote"
              active={snapshot?.blockquote}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
          </EditorMenu>

          <EditorMenu
            label="Alignment"
            disabled={!editor}
            trigger={<AlignLeft className="h-3.5 w-3.5" />}
          >
            <MenuRow
              label="Align left"
              active={snapshot?.alignLeft || (!snapshot?.alignCenter && !snapshot?.alignRight && !snapshot?.alignJustify)}
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </MenuRow>
            <MenuRow
              label="Align center"
              active={snapshot?.alignCenter}
              onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </MenuRow>
            <MenuRow
              label="Align right"
              active={snapshot?.alignRight}
              onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </MenuRow>
            <MenuRow
              label="Justify"
              active={snapshot?.alignJustify}
              onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </MenuRow>
          </EditorMenu>
        </div>

        <div className="inline-flex overflow-hidden rounded-full border border-[#e7a3ad] bg-white">
          <button
            type="button"
            onClick={onSaveVersion}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#b44a5a] transition-colors hover:bg-[#fdf2f4] disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            Save Version
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            title="Version history"
            aria-label="Version history"
            className="border-l border-[#e7a3ad] px-2.5 text-[#b44a5a] transition-colors hover:bg-[#fdf2f4]"
          >
            <Clock className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="mt-2 inline-flex items-center gap-2 px-1 text-sm text-muted" role="status">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "ready" || status === "saved"
              ? "bg-emerald-500"
              : status === "humanizing" || status === "restoring"
                ? "bg-amber-400"
                : "bg-slate-400",
          )}
          aria-hidden
        />
        Status: {STATUS_LABEL[status]}
      </p>
    </div>
  );
}

function MarkButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[#334155] transition-colors hover:bg-slate-100 disabled:opacity-40",
        active && "bg-slate-100 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />;
}

function EditorMenu({
  label,
  trigger,
  disabled,
  children,
}: {
  label: string;
  trigger: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 220;
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: Math.max(8, left),
      width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-lg px-2 text-[#334155] transition-colors hover:bg-slate-100 disabled:opacity-40"
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          style={menuStyle}
          className="z-[80] rounded-xl border border-border/70 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,20,0.14)]"
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-mint-dark/60 disabled:opacity-40",
        active && "bg-mint-dark",
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function LinkMenu({
  editor,
  active,
  href,
}: {
  editor: Editor | null;
  active: boolean;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(href);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (open) setValue(href);
  }, [href, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)),
      width: 260,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const applyLink = () => {
    if (!editor) return;
    const url = sanitizeEditorUrl(value);
    if (!url) {
      setError("Enter a valid http(s) or mailto link.");
      return;
    }
    setError(null);
    if (editor.state.selection.empty && !active) {
      editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        title="Link"
        aria-label="Link"
        aria-pressed={active}
        disabled={!editor}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[#334155] transition-colors hover:bg-slate-100 disabled:opacity-40",
          active && "bg-slate-100 text-primary",
        )}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Insert link"
          style={menuStyle}
          className="z-[80] rounded-xl border border-border/70 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,20,0.14)]"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            URL
            <input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
              }}
              placeholder="https://example.com"
              className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          <div className="mt-2 flex justify-end gap-2">
            {active ? (
              <button
                type="button"
                onClick={() => {
                  editor?.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-mint-dark/60"
              >
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={applyLink}
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
