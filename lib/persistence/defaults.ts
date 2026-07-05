/** Initial copy for editors and reset-after-clear-draft. */
import { DEFAULT_TEMPLATE_ID } from "@/lib/report/templates";

export { DEFAULT_TEMPLATE_ID };

export const DEFAULT_BIWEEKLY_DATE_RANGE = "2026.4.7 - 2026.4.18";
export const DEFAULT_ENGLISH_CLASS_NAME = "Infant D";
export const DEFAULT_SUB_TITLE = "从家庭走向集体的第一步";

export const DEFAULT_INTRO_HTML =
  "<p>亲爱的家长朋友们：</p><p>请在此编辑开篇问候与双周概述。</p>";

export const DEFAULT_BODY_HTML =
  "<p><strong>在此编写各板块正文</strong>（探究、活动、生活自理等）。生成时模型会据此输出带 <code>section</code> / <code>tips-section</code> 结构的 HTML。</p>";
