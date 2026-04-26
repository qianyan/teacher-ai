---
name: toddler-biweekly-report
description: Chinese toddler class biweekly newsletter (托班两周周报). The app assembles a full page from a locked HTML template; only the middle body (sections + tips) is LLM-generated. Photos use data-report-photo placeholders matched to uploaded logical filenames. Optional long PNG via in-app export or scripts/generate-long-screenshot.py.
---

# Toddler biweekly report (this app)

## What runs where

| Part | How it is produced |
|------|--------------------|
| **Page chrome** (head, CSS, header hero, container open) | Fixed file [reference-shell.html](reference-shell.html) — not edited by the model. |
| **Date badge, subtitle, intro** (`.info-badge`, `.sub-title`, `.intro-text`) | **Template replacement** on the server: values come from the API request, not from the model output. |
| **Middle of the page** (`.section` … + `.tips-section` …) | **AI-generated** HTML fragment only (`dynamicBodyHtml`). No `<!DOCTYPE>`, no `<html>`, no full header, no outer wrapper beyond those blocks. |
| **Footer** (red star bar, closing) | Fixed file [reference-footer.html](reference-footer.html) **appended** after the dynamic body. |

Full document build (see `lib/report/assemble.ts`):

1. `reference-shell.html` with replacements: biweekly range → `.info-badge`, subtitle → `.sub-title`, intro → `.intro-text`.
2. Then the model fragment (`dynamicBodyHtml`).
3. Then `reference-footer.html`.

The **model never outputs** the shell or footer; it only outputs the fragment in step 2.

## AI output (dynamic body only)

Strict structure:

1. **One or more** `<div class="section" style="background: …">` — alternate backgrounds: first section after the header uses `background: var(--color-bg)`, then `#fff` and `var(--color-bg)` in turn.
2. **One** `<div class="tips-section">` with `.tips-title`, `.tips-grid` / `.tip-card`, `.closing-section` as needed.

**Titles:** use `.section-title` and `.tips-title` (red, `var(--color-red)`; see shell CSS). **Do not** prefix with Chinese ordinals (一、二、…).

**Photos:** do not use `.photo-label`. **Landscape** grids: **6** images → `photo-grid grid-3` (3×2); **8** → `grid-4` (4×2). Other counts: follow the same class rules as in [reference-shell.html](reference-shell.html).

**Photo placeholders (app integration):** use empty `<img>` tags with `data-report-photo="PREFIX:INDEX"`. The prefix is the same text as the photo group name before the index in the logical filename; **INDEX** is the numeric part (e.g. file `探究1.jpg` → `data-report-photo="探究:1"`). The client maps these keys to uploaded blob URLs from `photoLogicalNames`.

Context for generation is JSON: `bodyHtml`, `introHtml`, `subTitle`, `biweeklyDateRange`, `photoLogicalNames` (see `POST /api/generate`).

## Biweekly date badge (中国大陆工作日)

The string in `.info-badge` should describe the **first and last 工作日** in the report’s two-week window (Asia/Shanghai), not a naïve calendar range that ignores weekends and public holidays. When the app fills the template, that string is the request’s `biweeklyDateRange` (escaped for HTML safety in the shell).

## Long PNG (optional)

The usual share artifact is a **single tall PNG** (e.g. 1080px wide). This repo can export via the app (e.g. long-screenshot path) or locally:

```bash
python3 scripts/generate-long-screenshot.py path/to/report.html
```

## Checklist (generation)

- [ ] Dynamic body is **only** `.section` + `.tips-section` fragments; no document shell or full `<html>`.
- [ ] Section backgrounds alternate as specified; no extra sections beyond supplied copy.
- [ ] **No** 一、二、… on `.section-title` / `.tips-title`.
- [ ] Grids: 6 → `grid-3`, 8 → `grid-4`; **no** `.photo-label`.
- [ ] `data-report-photo` keys align with `photoLogicalNames` (prefix + numeric index per file).
- [ ] `reference-shell.html` / `reference-footer.html` stay the canonical head and tail; only badge / subtitle / intro are substituted by the server.
