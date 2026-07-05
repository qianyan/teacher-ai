export type ReportTemplateId = "cream-soft" | "ocean-fresh";

export type ReportTemplateMeta = {
  id: ReportTemplateId;
  name: string;
  description: string;
  preview: { bg: string; primary: string; accent: string };
};

export const REPORT_TEMPLATES: Record<ReportTemplateId, ReportTemplateMeta> = {
  "cream-soft": {
    id: "cream-soft",
    name: "奶油柔和",
    description: "暖色卡通风格，适合入园与日常主题",
    preview: { bg: "#FFFBF5", primary: "#F4535A", accent: "#FEBE5E" },
  },
  "ocean-fresh": {
    id: "ocean-fresh",
    name: "清新海洋蓝",
    description: "天蓝清爽风格，气泡与波浪装饰",
    preview: { bg: "#F0F9FF", primary: "#0284C7", accent: "#38BDF8" },
  },
};

export const REPORT_TEMPLATE_LIST = Object.values(REPORT_TEMPLATES);

export const DEFAULT_TEMPLATE_ID: ReportTemplateId = "cream-soft";

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
  return (
    typeof value === "string" &&
    (value === "cream-soft" || value === "ocean-fresh")
  );
}

export function resolveTemplateId(value: unknown): ReportTemplateId {
  return isReportTemplateId(value) ? value : DEFAULT_TEMPLATE_ID;
}
