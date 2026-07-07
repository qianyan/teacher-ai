import type { ReportTemplateId } from "@/lib/report/templates";
import {
  groupPhotoKeysByPrefix,
  parseBodyHtml,
  resolveSectionPhotoIndices,
  type ParsedSection,
} from "@/lib/report/parse-body-html";

const SECTION_ICONS = ["🌱", "🎨", "🏃", "📚", "🎈", "✨", "🧩"];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function photoGridClass(count: number): string {
  if (count === 8 || count === 4) return "grid-4";
  if (count === 6 || count === 3 || count === 9) return "grid-3";
  if (count === 2) return "grid-2";
  if (count >= 4) return count > 6 ? "grid-4" : "grid-3";
  return "grid-2";
}

function renderPhotoImg(prefix: string, index: number): string {
  return `<div class="photo-item"><img src="" alt="" data-report-photo="${escapeHtml(prefix)}:${index}"></div>`;
}

function renderClassicPhotos(prefix: string, indices: number[]): string {
  if (!indices.length) return "";
  const gridClass = photoGridClass(indices.length);
  const items = indices.map((i) => renderPhotoImg(prefix, i)).join("");
  return `<div class="photo-grid ${gridClass}">${items}</div>`;
}

function renderStoryPhotos(prefix: string, indices: number[]): string {
  if (!indices.length) return "";
  const shapes = ["photo-item--circle", "photo-item--blob", "photo-item--leaf"];
  const mosaicClass =
    indices.length === 6
      ? "mosaic-6"
      : indices.length === 8
        ? "mosaic-8"
        : "mosaic-auto";
  const items = indices
    .map((index, i) =>
      `<div class="photo-item ${shapes[i % shapes.length]}"><img src="" alt="" data-report-photo="${escapeHtml(prefix)}:${index}"></div>`,
    )
    .join("");
  return `<div class="photo-mosaic ${mosaicClass}">${items}</div>`;
}

function renderBentoPhotos(prefix: string, indices: number[]): string {
  if (!indices.length) return "";
  const shapes = ["photo-item--hex", "photo-item--cloud", "photo-item--pill", "photo-item--round"];
  return indices
    .map(
      (index, i) =>
        `<div class="bento-cell bento-cell--photo span-2"><div class="photo-item ${shapes[i % shapes.length]}"><img src="" alt="" data-report-photo="${escapeHtml(prefix)}:${index}"></div></div>`,
    )
    .join("");
}

function wrapContent(contentHtml: string): string {
  const trimmed = contentHtml.trim();
  if (!trimmed) return "";
  if (trimmed.includes("content-box") || trimmed.includes("list-item")) {
    return trimmed;
  }
  return `<div class="content-box">${trimmed}</div>`;
}

function sectionBackground(index: number): string {
  return index % 2 === 0 ? "var(--color-bg)" : "#fff";
}

function renderClassicSection(
  section: ParsedSection,
  index: number,
  icon: string,
  photosHtml: string,
): string {
  return `<div class="section" style="background: ${sectionBackground(index)};">
  <div class="section-header">
    <div class="section-icon">${icon}</div>
    <div>
      <div class="section-title">${escapeHtml(section.title)}</div>
    </div>
  </div>
  ${wrapContent(section.contentHtml)}
  ${photosHtml}
</div>`;
}

function renderStorySection(
  section: ParsedSection,
  index: number,
  photosHtml: string,
): string {
  const flow = index % 2 === 0 ? "left" : "right";
  return `<div class="section section--story" style="background: ${sectionBackground(index)};" data-flow="${flow}">
  <div class="section-header section-header--story">
    <span class="section-marker"></span>
    <div>
      <div class="section-title">${escapeHtml(section.title)}</div>
    </div>
  </div>
  <div class="story-body">${wrapContent(section.contentHtml)}</div>
  ${photosHtml}
</div>`;
}

function renderBentoSection(
  section: ParsedSection,
  index: number,
  icon: string,
  photosHtml: string,
): string {
  return `<div class="section section--bento" style="background: ${sectionBackground(index)};">
  <div class="section-header section-header--bento">
    <span class="section-icon">${icon}</span>
    <div><div class="section-title">${escapeHtml(section.title)}</div></div>
  </div>
  <div class="bento-board">
    <div class="bento-cell bento-cell--text span-wide">${wrapContent(section.contentHtml)}</div>
    ${photosHtml}
  </div>
</div>`;
}

function renderTipsSection(
  tips: ParsedSection | null,
  templateId: ReportTemplateId,
): string {
  if (!tips) return "";

  const tipCardClass =
    templateId === "garden-story"
      ? "tip-card tip-card--leaf"
      : templateId === "candy-pop"
        ? "tip-card tip-card--bubble"
        : "tip-card";

  const tipsGridClass =
    templateId === "candy-pop" ? "tips-grid tips-grid--pop" : "tips-grid";

  const title = isTipsTitle(tips.title) ? tips.title : "给家长的小提示";
  const body = tips.contentHtml.trim();

  if (body.includes("tip-card") || body.includes("tips-section")) {
    return body.includes("tips-section") ? body : `<div class="tips-section">${body}</div>`;
  }

  const paragraphs = body.match(/<p[\s\S]*?<\/p>/gi) ?? [body];
  const cards = paragraphs
    .slice(0, 4)
    .map((p, i) => {
      const text = stripTags(p);
      if (!text) return "";
      return `<div class="${tipCardClass}"><h4>提示 ${i + 1}</h4><p>${text}</p></div>`;
    })
    .filter(Boolean)
    .join("");

  return `<div class="tips-section">
  <div class="tips-title">${escapeHtml(title.replace(/^(给)?家长的小提示$/i, "给家长的小提示"))}</div>
  <div class="${tipsGridClass}">${cards}</div>
  <div class="closing-section"><h3>感谢家长们的信任与配合</h3><p>愿每个孩子都能在爱与探索中快乐成长。</p></div>
</div>`;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function isTipsTitle(title: string): boolean {
  return /(家长|提示|家园)/i.test(title);
}

function renderSection(
  templateId: ReportTemplateId,
  section: ParsedSection,
  index: number,
  photosHtml: string,
): string {
  const icon = SECTION_ICONS[index % SECTION_ICONS.length];
  switch (templateId) {
    case "garden-story":
      return renderStorySection(section, index, photosHtml);
    case "candy-pop":
      return renderBentoSection(section, index, icon, photosHtml);
    case "cream-soft":
    case "ocean-fresh":
    default:
      return renderClassicSection(section, index, icon, photosHtml);
  }
}

function renderPhotos(
  templateId: ReportTemplateId,
  prefix: string,
  indices: number[],
): string {
  switch (templateId) {
    case "garden-story":
      return renderStoryPhotos(prefix, indices);
    case "candy-pop":
      return renderBentoPhotos(prefix, indices);
    default:
      return renderClassicPhotos(prefix, indices);
  }
}

export function isValidDynamicBodyHtml(html: string): boolean {
  const t = html.trim();
  if (t.length < 120) return false;
  if (!/\bclass=["'][^"']*\bsection\b/.test(t)) return false;
  return true;
}

export type RenderDynamicBodyInput = {
  templateId: ReportTemplateId;
  bodyHtml: string;
  photoLogicalNames: string[];
};

/** Deterministic section HTML from editor body + photo filenames (no LLM). */
export function renderDynamicBodyFromSource(
  input: RenderDynamicBodyInput,
): string {
  const parsed = parseBodyHtml(input.bodyHtml);
  const photoByPrefix = groupPhotoKeysByPrefix(input.photoLogicalNames);
  const usedPrefixes = new Set<string>();

  const sectionsHtml = parsed.sections
    .map((section, index) => {
      const photoMatch = resolveSectionPhotoIndices(
        section,
        parsed.sections,
        photoByPrefix,
        usedPrefixes,
      );
      const photosHtml = photoMatch
        ? renderPhotos(input.templateId, photoMatch.prefix, photoMatch.indices)
        : "";
      return renderSection(input.templateId, section, index, photosHtml);
    })
    .join("\n");

  const tipsHtml = renderTipsSection(parsed.tips, input.templateId);

  if (!sectionsHtml && !tipsHtml) {
    return `<div class="section" style="background: var(--color-bg);">
  <div class="content-box">${input.bodyHtml.trim() || "<p></p>"}</div>
</div>`;
  }

  return `${sectionsHtml}\n${tipsHtml}`.trim();
}
