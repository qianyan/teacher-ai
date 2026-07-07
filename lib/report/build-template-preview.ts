import { assembleFullDocument } from "@/lib/report/assemble";
import { readReferenceFooter, readTemplateShell } from "@/lib/report/read-assets";
import {
  resolveTemplateId,
  type ReportTemplateId,
} from "@/lib/report/templates";
import { buildPreviewBodyHtml } from "@/lib/report/templates/preview-samples";

const PREVIEW_META = {
  biweeklyDateRange: "2026.3.2 - 2026.3.13",
  englishClassName: "Infant D",
  subTitle: "主题预览 · 占位副标题",
  introHtml:
    "<p>这是一份<strong>主题预览</strong>，用于展示版式、配色与照片形状。正式生成时将替换为您的双周日期、班级名、开篇与真实照片。</p>",
} as const;

export function buildTemplatePreviewHtml(
  templateId: ReportTemplateId | unknown,
): string {
  const id = resolveTemplateId(templateId);
  const shell = readTemplateShell(id);
  const footer = readReferenceFooter();
  const dynamicBodyHtml = buildPreviewBodyHtml(id);

  return assembleFullDocument(shell, footer, {
    ...PREVIEW_META,
    dynamicBodyHtml,
  });
}
