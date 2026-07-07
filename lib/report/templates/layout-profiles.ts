import type { ReportTemplateId } from "./index";

export type TemplateLayoutProfile = {
  /** Short label for UI / docs */
  layoutName: string;
  /** Injected into the model system prompt when generating dynamic body */
  aiLayoutInstructions: string;
};

export const TEMPLATE_LAYOUT_PROFILES: Record<
  ReportTemplateId,
  TemplateLayoutProfile
> = {
  "cream-soft": {
    layoutName: "经典卡片",
    aiLayoutInstructions: `Layout: classic centered cards.
- Section header: \`<div class="section-header"><div class="section-icon">…</div><div><div class="section-title">…</div><div class="section-subtitle">…</div></div></div>\`
- Content: \`.content-box\`, \`.highlight-box\`, \`.list-item\` as needed.
- Photos: \`.photo-grid\` with \`.photo-item\` (rounded rectangle 16:9). 6→grid-3, 8→grid-4.`,
  },
  "ocean-fresh": {
    layoutName: "经典卡片",
    aiLayoutInstructions: `Layout: classic centered cards (same structure as cream-soft).
- Section header: \`.section-header\` + \`.section-icon\` + \`.section-title\` + optional \`.section-subtitle\`.
- Content: \`.content-box\`, \`.highlight-box\`, \`.list-item\`.
- Photos: \`.photo-grid\` + \`.photo-item\` (rounded rectangle 16:9). 6→grid-3, 8→grid-4.`,
  },
  "garden-story": {
    layoutName: "绘本折页",
    aiLayoutInstructions: `Layout: storybook zigzag — alternate reading flow left/right.
- Wrap each section: \`<div class="section section--story" data-flow="left|right">\` (first section data-flow="left", then alternate).
- Section header: \`<div class="section-header section-header--story"><span class="section-marker"></span><div class="section-title">…</div><div class="section-subtitle">…</div></div>\` (no section-icon).
- Content column: \`.story-body\` containing \`.content-box\`, \`.highlight-box\`, \`.list-item\`.
- Photos: \`.photo-mosaic\` (NOT photo-grid). Each item gets a rotating shape class:
  - \`.photo-item.photo-item--circle\` (1st, 4th, 7th…)
  - \`.photo-item.photo-item--blob\` (2nd, 5th, 8th…)
  - \`.photo-item.photo-item--leaf\` (3rd, 6th, 9th…)
  Cycle shapes in order. 6 photos → mosaic-6; 8 → mosaic-8; other counts use mosaic-auto.
- Tips: keep \`.tips-section\` but use \`.tip-card.tip-card--leaf\` for each tip.`,
  },
  "candy-pop": {
    layoutName: "糖果拼贴",
    aiLayoutInstructions: `Layout: playful bento collage — dense, offset blocks.
- Section: \`<div class="section section--bento">\`.
- Section header: \`<div class="section-header section-header--bento"><span class="section-icon">…</span><div class="section-title">…</div></div>\` (subtitle optional inside \`.section-tagline\`).
- Content + photos share a bento board: \`<div class="bento-board">\`
  - Text blocks: \`<div class="bento-cell bento-cell--text">…content-box / highlight-box / list-item…</div>\`
  - Photo blocks: \`<div class="bento-cell bento-cell--photo"><div class="photo-item photo-item--{shape}"><img …></div></div>\`
  - Assign photo shapes cycling: \`hex\`, \`cloud\`, \`pill\`, \`round\` (repeat). Never use star shapes. Mix text and photo cells; photos should not all sit in one row.
- Tips: \`.tip-card.tip-card--bubble\` inside \`.tips-grid.tips-grid--pop\`.`,
  },
};

export function getTemplateLayoutProfile(
  templateId: ReportTemplateId,
): TemplateLayoutProfile {
  return TEMPLATE_LAYOUT_PROFILES[templateId];
}
