/**
 * Assemble self-contained newsletter HTML from locked shell + dynamic body + footer.
 */

export type AssembleOptions = {
  /** Shown in `.info-badge` */
  biweeklyDateRange: string;
  /** English class name in `.title-en .name` (e.g. Infant D) */
  englishClassName: string;
  /** `.sub-title` line under the English titles */
  subTitle: string;
  /** Inner HTML for `.intro-text` (paragraphs) */
  introHtml: string;
  /** Model-generated: `.section` blocks + `.tips-section` only */
  dynamicBodyHtml: string;
};

export function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Apply user-controlled header fields to the raw `reference-shell.html` string.
 * `introHtml` is treated as HTML from a trusted editor (same origin).
 */
export function applyShellReplacements(
  shellHtml: string,
  opts: Pick<
    AssembleOptions,
    "biweeklyDateRange" | "englishClassName" | "subTitle" | "introHtml"
  >,
): string {
  let out = shellHtml;
  out = out.replace(
    /<span class="name">[\s\S]*?<\/span>/,
    `<span class="name">${escapeText(opts.englishClassName)}</span>`,
  );
  out = out.replace(
    /<span class="info-badge">[\s\S]*?<\/span>/,
    `<span class="info-badge">${escapeText(opts.biweeklyDateRange)}</span>`,
  );
  out = out.replace(
    /<div class="sub-title">[\s\S]*?<\/div>/,
    `<div class="sub-title">${escapeText(opts.subTitle)}</div>`,
  );
  out = out.replace(
    /<div class="intro-text">[\s\S]*?<\/div>/,
    `<div class="intro-text">${opts.introHtml}</div>`,
  );
  return out;
}

export function assembleFullDocument(
  shellHtml: string,
  footerHtml: string,
  opts: AssembleOptions,
): string {
  const head = applyShellReplacements(shellHtml, {
    biweeklyDateRange: opts.biweeklyDateRange,
    englishClassName: opts.englishClassName,
    subTitle: opts.subTitle,
    introHtml: opts.introHtml,
  });
  return `${head.trim()}\n${opts.dynamicBodyHtml.trim()}\n${footerHtml.trim()}\n`;
}
