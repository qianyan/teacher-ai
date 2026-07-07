"use client";

import { ReportPreviewIframe } from "@/components/ReportPreviewIframe";
import {
  REPORT_TEMPLATE_LIST,
  REPORT_TEMPLATES,
  type ReportTemplateId,
} from "@/lib/report/templates";
import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const previewCache = new Map<ReportTemplateId, string>();

async function fetchPreviewHtml(templateId: ReportTemplateId): Promise<string> {
  const cached = previewCache.get(templateId);
  if (cached) return cached;

  const res = await fetch(
    `/api/templates/preview?templateId=${encodeURIComponent(templateId)}`,
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `预览加载失败 (${res.status})`);
  }
  const data = (await res.json()) as { html: string };
  previewCache.set(templateId, data.html);
  return data.html;
}

type TemplatePreviewFrameProps = {
  templateId: ReportTemplateId;
  scaled?: boolean;
  className?: string;
};

function TemplatePreviewFrameInner({
  templateId,
  scaled = true,
  className,
}: TemplatePreviewFrameProps) {
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPreviewHtml(templateId)
      .then((html) => {
        if (!cancelled) {
          setSrcDoc(html);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "预览加载失败");
          setSrcDoc("");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (loading) {
    return (
      <div
        className={`template-preview-frame template-preview-frame--loading${className ? ` ${className}` : ""}`}
      >
        <div className="template-preview-frame__skeleton" aria-hidden />
        <span className="template-preview-frame__status">加载预览…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`template-preview-frame template-preview-frame--error${className ? ` ${className}` : ""}`}
      >
        <p className="template-preview-frame__status">{error}</p>
      </div>
    );
  }

  return (
    <ReportPreviewIframe
      srcDoc={srcDoc}
      title="主题版式预览"
      scaled={scaled}
      className={className}
    />
  );
}

const TemplatePreviewFrame = memo(TemplatePreviewFrameInner);

type PickerProps = {
  templateId: ReportTemplateId;
  onTemplateChange: (id: ReportTemplateId) => void;
  switchHint?: string | null;
};

function TemplatePickerInner({
  templateId,
  onTemplateChange,
  switchHint,
}: PickerProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const previewTitleId = "template-preview-title";

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenOpen]);

  return (
    <div className="template-picker-block">
      <fieldset className="template-picker">
        <legend className="app-label">周报主题</legend>
        <div className="template-picker-layout">
          <div
            className="template-picker__grid"
            role="radiogroup"
            aria-label="周报主题"
          >
            {REPORT_TEMPLATE_LIST.map((tpl) => {
              const selected = tpl.id === templateId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`template-card template-card--rich${selected ? " is-selected" : ""}`}
                  onClick={() => onTemplateChange(tpl.id)}
                  onMouseEnter={() => {
                    fetchPreviewHtml(tpl.id).catch(() => {});
                  }}
                  onFocus={() => {
                    fetchPreviewHtml(tpl.id).catch(() => {});
                  }}
                >
                  <div className="template-card__thumb" aria-hidden>
                    <span
                      className="template-card__swatch template-card__swatch--fill"
                      style={{
                        background: `linear-gradient(135deg, ${tpl.preview.bg} 0%, ${tpl.preview.bg} 38%, ${tpl.preview.primary} 38%, ${tpl.preview.primary} 68%, ${tpl.preview.accent} 68%)`,
                      }}
                    />
                  </div>
                  <span className="template-card__body">
                    <span className="template-card__name">{tpl.name}</span>
                    <span className="template-card__desc">{tpl.description}</span>
                    <span className="template-card__layout">{tpl.layoutTag}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="template-picker__detail">
            <div className="template-picker__detail-head">
              <div>
                <p className="template-picker__detail-kicker">完整版式预览</p>
                <h3
                  className="template-picker__detail-title"
                  id={previewTitleId}
                >
                  {REPORT_TEMPLATES[templateId].name}
                </h3>
                <p className="template-picker__detail-desc">
                  占位文字与占位图片，正式生成后替换为您的内容。
                </p>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => setFullscreenOpen(true)}
              >
                全屏预览
              </button>
            </div>
            <div className="template-picker__preview-well preview-scroll-well">
              <TemplatePreviewFrame
                templateId={templateId}
                scaled
                className="template-picker__preview-frame"
              />
            </div>
          </aside>
        </div>
      </fieldset>

      {switchHint && (
        <p className="workbench-hint workbench-hint--warn">{switchHint}</p>
      )}

      {portalMounted &&
        fullscreenOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal
            aria-labelledby={previewTitleId}
            className="template-preview-modal"
            onClick={() => setFullscreenOpen(false)}
          >
            <button
              type="button"
              className="btn btn--secondary template-preview-modal__close"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenOpen(false);
              }}
            >
              关闭
            </button>
            <div
              className="template-preview-modal__body preview-scroll-well"
              onClick={(e) => e.stopPropagation()}
            >
              <TemplatePreviewFrame
                templateId={templateId}
                scaled={false}
                className="template-preview-modal__frame"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export const TemplatePicker = memo(TemplatePickerInner);
