"use client";

import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import type { Document } from "@/db/schema";
import type { Brand } from "./documents-shell";

type Props = {
  doc: Document;
  brand: Brand;
  title: string;
  onTitleChange: (v: string) => void;
  saveAction: (input: {
    id: number;
    contentJson?: string;
    contentHtml?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const BRAND_SWATCHES: { label: string; value: string }[] = [
  { label: "Ink", value: "#20201C" },
  { label: "Orange", value: "#E8743B" },
  { label: "Teal", value: "#7FB2A6" },
  { label: "Green", value: "#7FB27F" },
  { label: "Amber", value: "#D6A95F" },
  { label: "Red", value: "#D6735F" },
];

const LOGO_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='16' fill='%23E8743B'/><text x='50%25' y='54%25' text-anchor='middle' dominant-baseline='middle' font-family='Fraunces,Georgia,serif' font-size='44' font-weight='600' fill='%230E0D0B'>JS</text></svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;utf8,${LOGO_SVG}`;

export function DocumentEditor({ doc, brand, title, onTitleChange, saveAction }: Props) {
  const [words, setWords] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const initialContent = parseInitialContent(doc.contentJson, doc.contentHtml);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tt-canvas",
      },
    },
    onCreate: ({ editor }) => setWords(countWords(editor.getText())),
    onUpdate: ({ editor }) => {
      setWords(countWords(editor.getText()));
      scheduleSave(editor);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function scheduleSave(ed: Editor) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      await saveAction({
        id: doc.id,
        contentJson: JSON.stringify(ed.getJSON()),
        contentHtml: ed.getHTML(),
      });
      setSaveState("saved");
    }, 600);
  }

  function exec(fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) {
    if (!editor) return;
    fn(editor.chain().focus()).run();
  }

  function addLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertLetterhead() {
    if (!editor) return;
    const details = [brand.abn ? `ABN ${brand.abn}` : "", brand.email, brand.address]
      .filter(Boolean)
      .join(" · ");
    editor
      .chain()
      .focus("start")
      .insertContentAt(0, [
        {
          type: "image",
          attrs: { src: LOGO_DATA_URI, alt: `${brand.legalName} logo`, width: 64, height: 64 },
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: brand.legalName }],
        },
        ...(details
          ? [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    marks: [{ type: "textStyle", attrs: { color: "#766C5F" } }],
                    text: details,
                  },
                ],
              },
            ]
          : []),
        { type: "horizontalRule" },
        { type: "paragraph" },
      ])
      .run();
  }

  function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = String(ev.target?.result ?? "");
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  }

  function exportHtml() {
    if (!editor) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
      title,
    )}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.7}img{max-width:100%}blockquote{border-left:3px solid #E8743B;padding-left:1em;color:#555}</style></head><body>${editor.getHTML()}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      (title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPdf() {
    if (!editor) return;
    const stamp = new Date().toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const printArea = document.getElementById("tt-print-area");
    if (!printArea) return;
    printArea.innerHTML = `${editor.getHTML()}<div class="pa-meta">Jordan Saker · ABN 95 658 646 131 · ${stamp}</div>`;
    const prevTitle = document.title;
    document.title = (title || "document").replace(/[^a-z0-9 ]+/gi, "").trim() || "document";
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
      printArea.innerHTML = "";
    }, 500);
  }

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  return (
    <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
      <input
        type="text"
        value={title}
        placeholder="Untitled document"
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full bg-transparent border-none text-text font-serif font-medium text-[1.35rem] sm:text-[1.5rem] px-4 sm:px-6 pt-4 sm:pt-5 pb-1.5 outline-none"
      />
      <div className="flex flex-wrap gap-1 px-3 sm:px-5 py-2 sm:py-2.5 border-t border-b border-line-soft sticky top-0 bg-surface z-[5]">
        <TbBtn active={isActive("bold")} onClick={() => exec((c) => c.toggleBold())} label="Bold" className="font-extrabold">
          B
        </TbBtn>
        <TbBtn active={isActive("italic")} onClick={() => exec((c) => c.toggleItalic())} label="Italic" className="italic">
          I
        </TbBtn>
        <TbBtn active={isActive("underline")} onClick={() => exec((c) => c.toggleUnderline())} label="Underline" className="underline">
          U
        </TbBtn>
        <TbBtn active={isActive("strike")} onClick={() => exec((c) => c.toggleStrike())} label="Strikethrough" className="line-through">
          S
        </TbBtn>
        <Sep />
        <TbBtn active={isActive("heading", { level: 1 })} onClick={() => exec((c) => c.toggleHeading({ level: 1 }))} label="Heading 1">
          H1
        </TbBtn>
        <TbBtn active={isActive("heading", { level: 2 })} onClick={() => exec((c) => c.toggleHeading({ level: 2 }))} label="Heading 2">
          H2
        </TbBtn>
        <TbBtn active={isActive("paragraph") && !isActive("heading")} onClick={() => exec((c) => c.setParagraph())} label="Body text">
          ¶
        </TbBtn>
        <TbBtn active={isActive("blockquote")} onClick={() => exec((c) => c.toggleBlockquote())} label="Quote">
          ❝
        </TbBtn>
        <Sep />
        <TbBtn active={isActive("bulletList")} onClick={() => exec((c) => c.toggleBulletList())} label="Bullet list">
          •
        </TbBtn>
        <TbBtn active={isActive("orderedList")} onClick={() => exec((c) => c.toggleOrderedList())} label="Numbered list">
          1.
        </TbBtn>
        <Sep />
        <TbBtn active={isActive("link")} onClick={addLink} label="Link">
          🔗
        </TbBtn>
        <TbBtn onClick={() => fileInput.current?.click()} label="Insert image">
          🖼
        </TbBtn>
        <TbBtn onClick={() => exec((c) => c.unsetAllMarks().clearNodes())} label="Clear formatting">
          ⌫
        </TbBtn>
        <Sep />
        {BRAND_SWATCHES.map((sw) => (
          <button
            key={sw.value}
            type="button"
            title={`Text colour: ${sw.label}`}
            aria-label={`Text colour ${sw.label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec((c) => c.setColor(sw.value))}
            className="w-7 h-7 sm:w-6 sm:h-6 rounded-full border border-line-soft transition-transform hover:scale-110"
            style={{ background: sw.value }}
          />
        ))}
        <TbBtn
          onClick={() => exec((c) => c.unsetColor().unsetHighlight())}
          label="Clear colour"
        >
          ⨯
        </TbBtn>
        <Sep />
        <button
          type="button"
          title="Insert letterhead"
          aria-label="Insert letterhead"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLetterhead}
          className="h-9 sm:h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[0.8rem] font-medium bg-accent-soft text-accent border border-accent-soft hover:bg-accent hover:text-bg transition-colors"
        >
          <span
            aria-hidden
            className="inline-block w-3.5 h-3.5 rounded-sm bg-current"
          />
          Letterhead
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImagePicked}
        />
      </div>
      <EditorContent editor={editor} />
      <div className="flex flex-wrap gap-3 justify-between items-center px-4 sm:px-5 py-3 border-t border-line-soft text-[0.78rem] text-muted">
        <span className="font-mono text-[0.72rem]">
          {words} words
          <span className="ml-3 text-muted-2">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
          </span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportHtml}
            className="px-3 py-1.5 text-[0.8rem] rounded-lg bg-transparent border border-line text-text hover:border-text"
          >
            HTML
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="px-3 py-1.5 text-[0.8rem] rounded-lg bg-accent text-bg font-semibold hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
          >
            Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function TbBtn({
  children,
  onClick,
  active,
  label,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-9 h-9 sm:min-w-8 sm:h-8 px-2 rounded-md inline-flex items-center justify-center text-[0.95rem] sm:text-[0.85rem] transition-colors border ${
        active
          ? "bg-accent-soft text-accent border-accent-soft"
          : "bg-transparent border-transparent text-muted hover:bg-bg-2 hover:text-text hover:border-line-soft"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px bg-line-soft mx-1.5 my-1" />;
}

function parseInitialContent(json: string, html: string): object | string {
  if (json && json !== "{}") {
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object" && "type" in parsed) return parsed;
    } catch {
      // fall through
    }
  }
  return html || "<p></p>";
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
