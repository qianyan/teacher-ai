"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  label: string;
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function RichEditor({
  label,
  valueHtml,
  onChangeHtml,
  placeholder = "在此输入…",
  minHeight = 160,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: valueHtml || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate: ({ editor }) => {
      onChangeHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || valueHtml === editor.getHTML()) return;
    editor.commands.setContent(valueHtml || "<p></p>", false);
  }, [editor, valueHtml]);

  return (
    <div className="rich-editor-wrap">
      <label className="app-label">{label}</label>
      <div
        className="rich-editor-surface"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .tiptap-editor {
          padding: 12px 14px;
          min-height: ${minHeight - 24}px;
          outline: none;
          font-size: 15px;
          line-height: 1.6;
          color: var(--text);
        }
        .tiptap-editor p {
          margin: 0 0 0.5em;
        }
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
