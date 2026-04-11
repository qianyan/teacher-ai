---
name: toddler-biweekly-report
description: Use when producing toddler class biweekly newsletter HTML (托班两周周报) with cream/soft template, variable sections, photo grids keyed by filename prefix, and a long PNG as the final deliverable; locks head/hero from reference-shell, mainland-China working-day date badge, then HTML to screenshot via scripts/generate-long-screenshot.py
---

# Toddler Biweekly Report (HTML → 长图 PNG)

**Pipeline:** self-contained `.html` (intermediate) → **`scripts/generate-long-screenshot.py`** → **final `*.png` (long screenshot, 1080px wide).**The default **final artifact for sharing is the image.**

## Locked chrome (do not edit)

**Source of truth:** [reference-shell.html](toddler-biweekly-report/reference-shell.html) (full `<head>` + inline CSS + `<body>` opening + `.container` + `.header` through the closing `</div>` of `.header`).

- **Keep byte-for-byte** except **one** substitution each issue: the text inside `<span class="info-badge">…</span>` — see **Biweekly date badge (中国大陆工作日)** below.
- Do **not** change `<title>`, English/Chinese titles, subtitle, intro paragraph, SVG decorations, or layout—those stay as in the reference (aligned with `托班两周周报_奶油色柔和_最终版.html`).
- **Footer:** append [reference-footer.html](toddler-biweekly-report/reference-footer.html) after the dynamic `tips-section` so the red star bar and document close match the reference.

If `reference-shell.html` is missing, recreate it from that final HTML file and apply the same CSS rules as below (especially landscape `.photo-item` and **no** `.photo-label`).

## Dynamic body (strict)

Only these regions are generated from user input:

1. **`.section` blocks** — order, titles, subtitles, icons, `.content-box` / `.highlight-box` / `.list-item` structure, and photo grids **must** match `body_content` and `photo_directory`. Do not add sections the user did not supply; do not paraphrase away required facts.

2. **`.tips-section`** — `.tips-title`, `.tips-grid` / `.tip-card`s, and `.closing-section` **only** from what the user provided (or explicitly asked to omit). Same markup classes as the reference.

**Alternating section backgrounds:** first section after the header uses `background: var(--color-bg)`; then alternate `#fff` and `var(--color-bg)`.

### Section titles and `.tips-title`

- **`.tips-title`** uses the same red as **`.section-title`** (`var(--color-red)`, `letter-spacing: 2px` in [reference-shell.html](toddler-biweekly-report/reference-shell.html)).
- **No numbering:** do not prefix `.section-title` or `.tips-title` with **一、二、三、** …; order follows document flow.

## Required inputs

1. **`body_content`** — Full copy and structure for sections + tips (titles, list items, highlights, tip cards, closing). **Sections are not fixed:** follow the author’s outline exactly.

2. **`photo_directory`** — Absolute path to images. **`photo_prefix` per section** groups files: `{prefix}{index}.{ext}` sorted by numeric index (see below).

3. **`biweekly_date_range`** — String for `.info-badge` only. Must follow **Mainland China working days** (中国大陆工作日); see next section.

If inputs are incomplete or prefixes are ambiguous, ask before generating HTML.

### Biweekly date badge (中国大陆工作日)

The badge is **not** a raw calendar span that ignores weekends/holidays. It must reflect the **first and last 工作日** in the report’s two-week window, using the **Asia/Shanghai** calendar.

- **Weekdays:** Monday–Friday count as potential working days; **Saturday and Sunday** are not 工作日 for this badge unless the user explicitly states otherwise (e.g. special make-up days).
- **Public holidays:** Exclude dates that are **法定节假日** or otherwise non-working for general offices/schools in mainland China for that year (国务院公布的放假安排). If a holiday **调休** makes a Sunday a 上班日, treat that Sunday as a working day for span purposes only when it is part of the reporting period and the user confirms school is in session.
- **Display format:** same style as the placeholder — `YYYY.M.D - YYYY.M.D` (no leading zeros required if matching existing examples, but be consistent within one file), where the two bounds are the **earliest and latest 工作日** covered by this 双周 period.

If the user supplies exact start/end dates, **validate** they are 工作日-aligned; if not, adjust bounds to the correct first/last 工作日 or ask for clarification.

## Photo grids (横版, no captions)

- Treat photos as **landscape**. CSS expects `.photo-item { aspect-ratio: 16 / 9; }` and `img { object-fit: cover; }` (already in `reference-shell.html`).
- **Column layout by count** (per section):
  - **6 images** → `class="photo-grid grid-3"` (3×2).
  - **8 images** → `class="photo-grid grid-4"` (4×2).
  - **Other counts:** `grid-2` for 2 or 4 images (1×2 / 2×2); `grid-3` for 3, 6, 9…; `grid-4` for 4 or 8 in two rows when 8. Prefer the 6/8 rules above when counts are exactly 6 or 8.
- **No text on photos:** do **not** output `.photo-label` or any overlay caption under images. Markup is only:

```html
<div class="photo-grid grid-3">
  <div class="photo-item"><img src="ABSOLUTE_PATH" alt=""></div>
</div>
```

Use meaningful `alt` only if needed for accessibility; keep `alt` minimal or empty to avoid duplicating body copy.

## Photo filename ↔ section

**Rule:** Each section with photos declares a **`photo_prefix`**: the substring before the numeric index in the filename.

**Pattern:** `{photo_prefix}{index}.{ext}` — e.g. `情绪适应1.jpg`, `快乐活动6.JPG`. Sort by **numeric** index. Extensions: `.jpg`, `.jpeg`, `.JPG`, `.png`, `.webp`, etc.

**Steps:**

1. Parse `body_content` for ordered sections and each section’s `photo_prefix` (explicit in copy — if unclear, ask).
2. List `photo_directory` and group files by prefix (longest match: prefix is everything before the last run of digits before the extension).
3. Build one grid per section; **absolute** paths for `src` (expand `~`, encode spaces).

**Gaps:** If a prefix has no files, omit the grid or note in an HTML comment. **Orphan files** — list in a top-of-file HTML comment; do not invent sections.

## Assemble the HTML file

1. Start from [reference-shell.html](toddler-biweekly-report/reference-shell.html); set `.info-badge` to `biweekly_date_range` (must satisfy **中国大陆工作日** rules above).
2. Insert all `.section`… HTML (with correct backgrounds and grids).
3. Insert the full `.tips-section`… block from `body_content`.
4. Append [reference-footer.html](toddler-biweekly-report/reference-footer.html).

Output: single self-contained `.html`, UTF-8, `lang="zh-CN"`, inline CSS/SVG from the shell (no external CSS).

## Final image — `scripts/`

**Goal:** the **deliverable parents/school actually send or post is a single long PNG**, not the raw HTML.

1. After the `.html` is complete and saved (e.g. `toddler-biweekly-report-2026-04-11.html`), run from the **repository root**:

```bash
python3 scripts/generate-long-screenshot.py path/to/toddler-biweekly-report-YYYY-MM-DD.html
```

2. **Behavior** ([scripts/generate-long-screenshot.py](../../scripts/generate-long-screenshot.py)): Chrome headless full-page screenshot at **1080px** width; estimated height from section/photo/list counts; writes **`{same-basename}.png`** next to the HTML (absolute path).

3. **Verify:** open the PNG; confirm no clipped footer, no blank tail, and photos load (HTML uses absolute `file://` image paths on the machine that runs the script).

## Checklist

- [ ] `reference-shell.html` head + header unchanged except `.info-badge` (中国大陆工作日起止).
- [ ] Sections + tips match `body_content` strictly; no extra boilerplate sections; no **一、二、…** on `.section-title` / `.tips-title`; `.tips-title` red like `.section-title`.
- [ ] Photo grids: 6 → `grid-3`, 8 → `grid-4`; landscape; **no** `.photo-label`.
- [ ] Paths absolute; orphan/missing files documented if applicable.
- [ ] **Long PNG generated** with `scripts/generate-long-screenshot.py` and checked visually.
