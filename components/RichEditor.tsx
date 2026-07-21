"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useEffect, useRef, type CSSProperties } from "react";

type Props = {
  label: string;
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

const CHANGE_DEBOUNCE_MS = 300;

function RichEditorInner({
  label,
  valueHtml,
  onChangeHtml,
  placeholder = "在此输入…",
  minHeight = 160,
}: Props) {
  const onChangeRef = useRef(onChangeHtml);
  onChangeRef.current = onChangeHtml;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const flushPending = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingHtmlRef.current !== null) {
      onChangeRef.current(pendingHtmlRef.current);
      pendingHtmlRef.current = null;
    }
  };

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
      const html = editor.getHTML();
      pendingHtmlRef.current = html;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (pendingHtmlRef.current !== null) {
          onChangeRef.current(pendingHtmlRef.current);
          pendingHtmlRef.current = null;
        }
      }, CHANGE_DEBOUNCE_MS);
    },
    onBlur: () => {
      flushPending();
    },
    onFocus: () => {
      // When the virtual keyboard opens on phones, the editor can end up
      // hidden behind it. After the keyboard animates in, scroll the editor
      // surface back into the visible viewport. Desktop focus is untouched.
      window.setTimeout(() => {
        if (!window.matchMedia("(max-width: 720px)").matches) return;
        surfaceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 350);
    },
  });

  useEffect(() => {
    return () => {
      flushPending();
    };
  }, []);

  useEffect(() => {
    if (!editor || valueHtml === editor.getHTML()) return;
    flushPending();
    editor.commands.setContent(valueHtml || "<p></p>", false);
  }, [editor, valueHtml]);

  return (
    <div className="rich-editor-wrap">
      <label className="app-label">{label}</label>
      <div
        ref={surfaceRef}
        className="rich-editor-surface"
        style={
          {
            minHeight,
            "--rich-editor-min-height": `${minHeight}px`,
          } as CSSProperties
        }
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const RichEditor = memo(RichEditorInner);
