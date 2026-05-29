"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { resizeImageForUpload } from "../_lib/resize-image-for-upload";
import { adminApiFetch, formatAdminApiMessage } from "@/lib/admin-api-fetch";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { newsContentForEditor } from "@/lib/news-html";

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      className={`news-rich-editor__tb${active ? " news-rich-editor__tb--active" : ""}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function NewsRichEditor({
  value,
  onChange,
  disabled,
  placeholder = "Write the article — headings, lists, bold text, links, and inline images."
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const notify = usePortalAuthNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = newsContentForEditor(value);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { HTMLAttributes: { class: "news-rich-ul" } },
        orderedList: { HTMLAttributes: { class: "news-rich-ol" } }
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder })
    ],
    content: initial,
    editorProps: {
      attributes: {
        class: "news-rich-editor__pm",
        spellCheck: "true"
      }
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const next = newsContentForEditor(value);
    const cur = editor.getHTML();
    if (cur === next || cur.replace(/\s/g, "") === next.replace(/\s/g, "")) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("Link URL", prev ?? "https://");
    if (next === null) return;
    const url = next.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank", rel: "noopener noreferrer" }).run();
  }, [editor]);

  const pickImage = useCallback(() => {
    if (disabled) return;
    fileRef.current?.click();
  }, [disabled]);

  const onFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !editor) return;
      try {
        const prepared = await resizeImageForUpload(file, 1600);
        const fd = new FormData();
        fd.append("file", prepared);
        const r = await adminApiFetch("/api/admin/cms/upload", { method: "POST", body: fd });
        const data = (await r.json()) as { url?: string; message?: string };
        if (!r.ok || !data.url) {
          notify.error(formatAdminApiMessage(r.status, data.message ?? "Upload failed"), { status: r.status });
          return;
        }
        editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
      } catch {
        notify.error("Could not insert image. Please try again.");
      }
    },
    [editor, notify]
  );

  if (!editor) {
    return <div className="news-rich-editor news-rich-editor--loading muted">Loading editor…</div>;
  }

  return (
    <div className={`news-rich-editor${disabled ? " news-rich-editor--disabled" : ""}`}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={onFile} />
      <div className="news-rich-editor__toolbar" role="toolbar" aria-label="Formatting">
        <ToolbarButton
          title="Bold"
          disabled={disabled}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          disabled={disabled}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          disabled={disabled}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </ToolbarButton>
        <span className="news-rich-editor__tb-sep" aria-hidden />
        <ToolbarButton
          title="Heading 2"
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          disabled={disabled}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <span className="news-rich-editor__tb-sep" aria-hidden />
        <ToolbarButton
          title="Bullet list"
          disabled={disabled}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          disabled={disabled}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          disabled={disabled}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          “ ”
        </ToolbarButton>
        <span className="news-rich-editor__tb-sep" aria-hidden />
        <ToolbarButton title="Link" disabled={disabled} active={editor.isActive("link")} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Insert image from file" disabled={disabled} onClick={pickImage}>
          Image
        </ToolbarButton>
        <ToolbarButton title="Horizontal rule" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          HR
        </ToolbarButton>
        <span className="news-rich-editor__tb-sep" aria-hidden />
        <ToolbarButton title="Undo" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          Undo
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          Redo
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
