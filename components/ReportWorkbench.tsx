"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { type ReportTemplateId } from "@/lib/report/templates";
import dynamic from "next/dynamic";
import {
  memo,
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const RichEditor = dynamic(
  () =>
    import("@/components/RichEditor").then((m) => ({
      default: m.RichEditor,
    })),
  {
    ssr: false,
    loading: () => <div className="workbench-skeleton workbench-skeleton--editor" />,
  },
);

const PhotoList = dynamic(
  () =>
    import("@/components/PhotoList").then((m) => ({
      default: m.PhotoList,
    })),
  {
    ssr: false,
    loading: () => <div className="workbench-skeleton workbench-skeleton--photos" />,
  },
);

const PreviewPanel = dynamic(
  () =>
    import("@/components/PreviewPanel").then((m) => ({
      default: m.PreviewPanel,
    })),
  {
    ssr: false,
    loading: () => <div className="workbench-skeleton workbench-skeleton--preview" />,
  },
);

const TemplatePicker = dynamic(
  () =>
    import("@/components/TemplatePicker").then((m) => ({
      default: m.TemplatePicker,
    })),
  {
    ssr: false,
    loading: () => <div className="workbench-skeleton workbench-skeleton--template" />,
  },
);

type WorkbenchStep = "meta" | "write" | "photos" | "preview";
type WritePane = "intro" | "body";

const STEPS: {
  id: WorkbenchStep;
  label: string;
  hint: string;
}[] = [
  { id: "meta", label: "版面", hint: "日期与标题" },
  { id: "write", label: "撰文", hint: "开篇与正文" },
  { id: "photos", label: "照片", hint: "导入与生成" },
  { id: "preview", label: "预览", hint: "导出长图" },
];

type Props = {
  templateId: ReportTemplateId;
  setTemplateId: (v: ReportTemplateId) => void;
  biweeklyDateRange: string;
  setBiweeklyDateRange: (v: string) => void;
  englishClassName: string;
  setEnglishClassName: (v: string) => void;
  subTitle: string;
  setSubTitle: (v: string) => void;
  introHtml: string;
  setIntroHtml: (v: string) => void;
  bodyHtml: string;
  setBodyHtml: (v: string) => void;
  photos: PhotoEntry[];
  setPhotos: Dispatch<SetStateAction<PhotoEntry[]>>;
  fullHtml: string | null;
  setFullHtml: (v: string | null) => void;
  loading: boolean;
  error: string | null;
  generateBlockedReason?: string;
  usageHint?: string;
  onGenerate: () => void;
  advanceToPreview?: boolean;
  onAdvanceToPreviewConsumed?: () => void;
};

function ReportWorkbenchInner({
  templateId,
  setTemplateId,
  biweeklyDateRange,
  setBiweeklyDateRange,
  englishClassName,
  setEnglishClassName,
  subTitle,
  setSubTitle,
  introHtml,
  setIntroHtml,
  bodyHtml,
  setBodyHtml,
  photos,
  setPhotos,
  fullHtml,
  setFullHtml,
  loading,
  error,
  generateBlockedReason,
  usageHint,
  onGenerate,
  advanceToPreview,
  onAdvanceToPreviewConsumed,
}: Props) {
  const [step, setStep] = useState<WorkbenchStep>("meta");
  const [writePane, setWritePane] = useState<WritePane>("intro");
  const [templateSwitchHint, setTemplateSwitchHint] = useState<string | null>(
    null,
  );
  const [visited, setVisited] = useState<Set<WorkbenchStep>>(
    () => new Set(["meta"]),
  );

  const goToStep = useCallback((next: WorkbenchStep) => {
    setStep(next);
    setVisited((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  }, []);

  useEffect(() => {
    if (!advanceToPreview) return;
    goToStep("preview");
    onAdvanceToPreviewConsumed?.();
  }, [advanceToPreview, goToStep, onAdvanceToPreviewConsumed]);

  useEffect(() => {
    if (fullHtml) setTemplateSwitchHint(null);
  }, [fullHtml]);

  const handleTemplateChange = useCallback(
    (next: ReportTemplateId) => {
      if (next === templateId) return;
      setTemplateId(next);
      if (fullHtml) {
        setFullHtml(null);
        setTemplateSwitchHint("主题已更换，请重新生成预览。");
      } else {
        setTemplateSwitchHint(null);
      }
    },
    [fullHtml, setFullHtml, setTemplateId, templateId],
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="workbench">
      <nav className="workbench-rail" aria-label="简报制作步骤">
        <ol className="workbench-rail__track">
          {STEPS.map((s, i) => {
            const isActive = s.id === step;
            const isDone =
              s.id === "meta"
                ? Boolean(
                    biweeklyDateRange.trim() &&
                      englishClassName.trim() &&
                      subTitle.trim(),
                  )
                : s.id === "write"
                  ? introHtml.replace(/<[^>]+>/g, "").trim().length > 0 &&
                    bodyHtml.replace(/<[^>]+>/g, "").trim().length > 0
                  : s.id === "photos"
                    ? photos.length > 0
                    : Boolean(fullHtml);
            return (
              <li key={s.id} className="workbench-rail__item">
                {i > 0 && (
                  <span
                    className={`workbench-rail__wire${i <= stepIndex ? " is-lit" : ""}`}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  className={`workbench-step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}${visited.has(s.id) ? " is-visited" : ""}`}
                  onClick={() => goToStep(s.id)}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="workbench-step__sticker" aria-hidden>
                    <StepIcon id={s.id} />
                  </span>
                  <span className="workbench-step__body">
                    <span className="workbench-step__label">{s.label}</span>
                    <span className="workbench-step__hint">{s.hint}</span>
                  </span>
                  {s.id === "photos" && photos.length > 0 && (
                    <span className="workbench-step__badge">{photos.length}</span>
                  )}
                  {s.id === "preview" && fullHtml && (
                    <span className="workbench-step__badge workbench-step__badge--ready">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="workbench-stage">
        {step === "meta" && (
          <section className="app-panel workbench-panel workbench-panel--meta">
            <header className="workbench-panel__head">
              <p className="workbench-panel__kicker">第一步 · 贴好日期徽章</p>
              <h2 className="app-section-title">版面与日期</h2>
              <p className="workbench-panel__lede">
                像手帐扉页一样先定好双周区间与副标题，后面的撰文和照片都会跟着这一版式走。
              </p>
            </header>
            <TemplatePicker
              templateId={templateId}
              onTemplateChange={handleTemplateChange}
              switchHint={templateSwitchHint}
            />
            <label className="app-label" htmlFor="english-class-name">
              英文班级名（大标题，如 Infant D）
            </label>
            <input
              id="english-class-name"
              type="text"
              value={englishClassName}
              onChange={(e) => setEnglishClassName(e.target.value)}
              className="app-input"
              style={{ marginBottom: 16 }}
            />
            <label className="app-label" htmlFor="biweekly-range">
              双周日期徽章（中国大陆工作日）
            </label>
            <input
              id="biweekly-range"
              type="text"
              value={biweeklyDateRange}
              onChange={(e) => setBiweeklyDateRange(e.target.value)}
              className="app-input app-input--narrow"
              style={{ marginBottom: 16 }}
            />
            <label className="app-label" htmlFor="sub-title">
              副标题（横幅下红字一行）
            </label>
            <input
              id="sub-title"
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              className="app-input"
              style={{ marginBottom: 0 }}
            />
            <div className="workbench-panel__foot">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => goToStep("write")}
              >
                下一步：撰文
              </button>
            </div>
          </section>
        )}

        {step === "write" && (
          <section className="app-panel workbench-panel workbench-panel--write">
            <header className="workbench-panel__head">
              <p className="workbench-panel__kicker">第二步 · 写下本周故事</p>
              <h2 className="app-section-title">开篇与正文</h2>
              <p className="workbench-panel__lede">
                一次只打开一个编辑区，减轻页面负担；切换页签时内容会自动保存到草稿。
              </p>
            </header>
            <div
              className="workbench-write-tabs"
              role="tablist"
              aria-label="撰文页签"
            >
              <button
                type="button"
                role="tab"
                aria-selected={writePane === "intro"}
                className={`workbench-write-tab${writePane === "intro" ? " is-active" : ""}`}
                onClick={() => setWritePane("intro")}
              >
                开篇
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={writePane === "body"}
                className={`workbench-write-tab${writePane === "body" ? " is-active" : ""}`}
                onClick={() => setWritePane("body")}
              >
                结构化正文
              </button>
            </div>
            <div className="workbench-write-pane" role="tabpanel">
              {writePane === "intro" ? (
                <RichEditor
                  key="intro"
                  label="开篇（白底 intro 区域）"
                  valueHtml={introHtml}
                  onChangeHtml={setIntroHtml}
                  placeholder="问候语与双周概述…"
                  minHeight={180}
                />
              ) : (
                <RichEditor
                  key="body"
                  label="结构化正文（各板块要点，供模型扩展为 section）"
                  valueHtml={bodyHtml}
                  onChangeHtml={setBodyHtml}
                  placeholder="按板块写好要点与照片前缀说明…"
                  minHeight={320}
                />
              )}
            </div>
            <div className="workbench-panel__foot workbench-panel__foot--split">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => goToStep("meta")}
              >
                上一步
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => goToStep("photos")}
              >
                下一步：照片
              </button>
            </div>
          </section>
        )}

        <div style={{ display: step !== "photos" ? "none" : undefined }}>
          <section className="app-panel workbench-panel workbench-panel--photos">
            <header className="workbench-panel__head">
              <p className="workbench-panel__kicker">第三步 · 拼贴照片</p>
              <h2 className="app-section-title">照片与生成</h2>
              <p className="workbench-panel__lede">
                导入带前缀序号的照片、排好顺序，全部同步到 Blob 后即可生成 1080px 预览。
              </p>
            </header>
            <PhotoList photos={photos} onChange={setPhotos} />
            {usageHint && (
              <p className="workbench-hint workbench-hint--quota">{usageHint}</p>
            )}
            {generateBlockedReason && (
              <p className="workbench-hint workbench-hint--warn">
                {generateBlockedReason}
              </p>
            )}
            <button
              type="button"
              className="btn btn--primary btn--lg workbench-generate-btn"
              onClick={onGenerate}
              disabled={loading || Boolean(generateBlockedReason)}
              title={generateBlockedReason}
            >
              {loading ? "生成中…" : "生成预览 HTML"}
            </button>
            {error && <p className="text-error">{error}</p>}
            <div className="workbench-panel__foot workbench-panel__foot--split">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => goToStep("write")}
              >
                上一步
              </button>
              {fullHtml && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => goToStep("preview")}
                >
                  查看预览
                </button>
              )}
            </div>
          </section>
        </div>

        <div style={{ display: step !== "preview" ? "none" : undefined }}>
          <section className="app-panel workbench-panel workbench-panel--preview">
            <header className="workbench-panel__head">
              <p className="workbench-panel__kicker">第四步 · 导出分享</p>
              <h2 className="app-section-title">预览与导出</h2>
              {!fullHtml && (
                <p className="workbench-panel__lede">
                  请先在「照片」步骤生成预览 HTML，再回来导出长图或下载文件。
                </p>
              )}
            </header>
            {fullHtml ? (
              <PreviewPanel fullHtml={fullHtml} photos={photos} />
            ) : (
              <div className="workbench-empty-preview">
                <span className="workbench-empty-preview__icon" aria-hidden>
                  ✦
                </span>
                <p>尚无预览内容</p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => goToStep("photos")}
                >
                  去生成预览
                </button>
              </div>
            )}
            <div className="workbench-panel__foot">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => goToStep("photos")}
              >
                返回照片步骤
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StepIcon({ id }: { id: WorkbenchStep }) {
  switch (id) {
    case "meta":
      return <IconStepLayout />;
    case "write":
      return <IconStepPen />;
    case "photos":
      return <IconStepImage />;
    case "preview":
      return <IconStepEye />;
  }
}

function IconStepLayout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconStepPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStepImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8.5" cy="8.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconStepEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export const ReportWorkbench = memo(ReportWorkbenchInner);
