# Module-level photo preview cache; mount only the active workbench step

#21 kept `PhotoList` and `PreviewPanel` always mounted behind `display:none` so `usePhotoPreviewCache` survived step switches. On Android (Chrome / system browser), with photos present and preview HTML already generated, toggling those two heavy trees still causes repeated full-screen white flashes when switching 照片步骤 ↔ 预览步骤 — worse returning to photos. We reverse that mount strategy: keep a **module-level** thumbnail/preview URL cache (invalidate per photo entry; clear on draft clear / logout; do **not** clear on leaving the photos step), and **mount only the active workbench step** so the preview iframe is not kept alive while hidden. Entering preview may show one render wait; revisit photos must not rebuild the whole filmstrip from skeletons or flash the full screen.

## Considered Options

- **Keep dual-mount, change hiding** (`visibility` / `content-visibility` / freeze iframe) — lower churn, but both heavy trees stay in the document; rejected as the primary fix after the dual-mount approach already failed to stop Android full-screen flashes.
- **React Context cache at workbench root** — still couples cache lifetime to a React subtree; rejected in favour of a module singleton until cross-tree subscription is clearly needed.
- **Module-level cache + single active step** (chosen) — preserves thumbnails across remounts without paying for two heavy panels at once.
