export type ReportTemplateId =
  | "cream-soft"
  | "ocean-fresh"
  | "garden-story"
  | "candy-pop";

export type ReportTemplateMeta = {
  id: ReportTemplateId;
  name: string;
  description: string;
  layoutTag: string;
  preview: { bg: string; primary: string; accent: string };
};

export const REPORT_TEMPLATES: Record<ReportTemplateId, ReportTemplateMeta> = {
  "cream-soft": {
    id: "cream-soft",
    name: "奶油柔和",
    description: "暖色卡通风格，适合入园与日常主题",
    layoutTag: "经典卡片",
    preview: { bg: "#FFFBF5", primary: "#F4535A", accent: "#FEBE5E" },
  },
  "ocean-fresh": {
    id: "ocean-fresh",
    name: "清新海洋蓝",
    description: "天蓝清爽风格，气泡与波浪装饰",
    layoutTag: "经典卡片",
    preview: { bg: "#F0F9FF", primary: "#0284C7", accent: "#38BDF8" },
  },
  "garden-story": {
    id: "garden-story",
    name: "自然绘本",
    description: "折页式阅读动线，圆形·水滴·叶片相框",
    layoutTag: "绘本折页",
    preview: { bg: "#FAF7F2", primary: "#4A6741", accent: "#E8C4C4" },
  },
  "candy-pop": {
    id: "candy-pop",
    name: "糖果乐园",
    description: "拼贴便当格，六边形·云朵·胶囊相框",
    layoutTag: "糖果拼贴",
    preview: { bg: "#FFF5F7", primary: "#FF85A2", accent: "#FFE066" },
  },
};

export const REPORT_TEMPLATE_LIST = Object.values(REPORT_TEMPLATES);

export const DEFAULT_TEMPLATE_ID: ReportTemplateId = "cream-soft";

const TEMPLATE_IDS: ReportTemplateId[] = [
  "cream-soft",
  "ocean-fresh",
  "garden-story",
  "candy-pop",
];

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
  return typeof value === "string" && TEMPLATE_IDS.includes(value as ReportTemplateId);
}

export function resolveTemplateId(value: unknown): ReportTemplateId {
  return isReportTemplateId(value) ? value : DEFAULT_TEMPLATE_ID;
}
